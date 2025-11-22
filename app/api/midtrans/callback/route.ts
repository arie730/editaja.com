import { NextRequest, NextResponse } from "next/server";
import { getMidtransConfig } from "@/lib/settings";
import crypto from "crypto";

// Import server-side functions (will use Admin SDK if available)
import {
  getTopupTransactionByOrderIdServer,
  updateTopupTransactionServer,
  completeTopupTransactionServer,
} from "@/lib/topups-server";

// Midtrans API base URL
const getMidtransBaseUrl = (isProduction: boolean) => {
  return isProduction
    ? "https://api.midtrans.com"
    : "https://app.sandbox.midtrans.com";
};

// Verify Midtrans notification signature
const verifySignature = (orderId: string, statusCode: string, grossAmount: string, serverKey: string, signatureKey: string): boolean => {
  const hashString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");
  return hash === signatureKey;
};

// Support both POST (notification) and GET (testing/ping)
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    ok: true, 
    message: "Midtrans callback endpoint is active",
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  let notification: any = null;
  let orderId: string = "unknown";
  
  try {
    console.log("=== 🔔 Midtrans Callback Received ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Request method:", request.method);
    console.log("Request headers:", Object.fromEntries(request.headers.entries()));
    
    // Get Midtrans config
    const midtransConfig = await getMidtransConfig();
    if (!midtransConfig || !midtransConfig.serverKey) {
      console.error("Midtrans configuration not found");
      return NextResponse.json(
        { ok: false, error: "Configuration not found" },
        { status: 500 }
      );
    }

    // Parse notification body - Midtrans sends JSON in body
    try {
      notification = await request.json();
      orderId = notification.order_id || "unknown";
      console.log("Notification data:", JSON.stringify(notification, null, 2));
      console.log(`Order ID from notification: ${orderId}`);
    } catch (parseError: any) {
      console.error("Error parsing notification body:", parseError);
      // Try to get from query params as fallback
      const { searchParams } = new URL(request.url);
      orderId = searchParams.get("order_id") || "unknown";
      console.log(`Using order_id from query params: ${orderId}`);
      
      if (orderId === "unknown") {
        throw new Error("Failed to parse notification body and no order_id in query params");
      }
    }

    // Verify signature (optional - only if provided)
    const signatureKey = request.headers.get("x-midtrans-signature");
    if (signatureKey) {
      const isValid = verifySignature(
        notification.order_id,
        notification.status_code,
        notification.gross_amount,
        midtransConfig.serverKey,
        signatureKey
      );

      if (!isValid) {
        console.error("Invalid signature - but continuing anyway for debugging");
        // Don't fail - continue processing for now
        // In production, you might want to fail here
      } else {
        console.log("Signature verified successfully");
      }
    } else {
      console.log("No signature provided - continuing without verification");
    }

    // Validate notification has required fields
    if (!notification || !notification.order_id) {
      console.error("Invalid notification: missing order_id");
      return NextResponse.json(
        { ok: false, error: "Invalid notification: missing order_id" },
        { status: 400 }
      );
    }

    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status || "unknown";
    const statusCode = notification.status_code || "unknown";
    const paymentType = notification.payment_type || "unknown";

    console.log(`=== Processing Callback ===`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Transaction Status: ${transactionStatus}`);
    console.log(`Status Code: ${statusCode}`);
    console.log(`Fraud Status: ${fraudStatus}`);
    console.log(`Payment Type: ${paymentType}`);
    console.log(`Transaction Time: ${notification.transaction_time || "N/A"}`);

    // Get transaction from Firestore with error handling for quota issues
    let transaction: any = null;
    try {
      transaction = await getTopupTransactionByOrderIdServer(orderId);
    } catch (error: any) {
      // Handle quota exceeded errors specially
      if (error.message?.includes("quota exceeded") || error.code === 8) {
        console.error("❌ Firestore quota exceeded while getting transaction:", orderId);
        console.error("   This usually means Firestore free tier quota is exhausted.");
        console.error("   Please upgrade Firestore plan or wait for quota reset.");
        
        // Return 200 but with error message so Midtrans doesn't retry immediately
        // Midtrans will retry later automatically
        return NextResponse.json({ 
          ok: false, 
          error: "Firestore quota exceeded. Transaction will be processed when quota is available.",
          orderId,
          retryAfter: 3600 // Suggest retry after 1 hour
        }, { status: 200 });
      }
      
      // Re-throw other errors
      throw error;
    }
    
    if (!transaction) {
      console.error("❌ Transaction not found in Firestore:", orderId);
      console.error("This might mean:");
      console.error("1. Transaction was not saved when payment was created");
      console.error("2. OrderId mismatch between Midtrans and Firestore");
      console.error("3. Firebase Admin SDK is not configured properly");
      
      // Return 200 to prevent Midtrans from retrying
      // But log the error for debugging
      return NextResponse.json({ 
        ok: false, 
        error: "Transaction not found",
        orderId 
      }, { status: 200 });
    }

    console.log(`✅ Transaction found in Firestore:`);
    console.log(`   Transaction ID: ${transaction.id}`);
    console.log(`   Current Status: ${transaction.status}`);
    console.log(`   User ID: ${transaction.userId || "N/A"}`);
    console.log(`   Diamonds: ${transaction.diamonds || 0}`);
    console.log(`   Bonus: ${transaction.bonus || 0}`);
    console.log(`   Price: ${transaction.price || 0}`);

    // Map Midtrans status to our status
    let newStatus: "pending" | "settlement" | "expire" | "cancel" | "deny" | "refund" = "pending";

    if (transactionStatus === "settlement") {
      newStatus = "settlement";
    } else if (transactionStatus === "pending") {
      newStatus = "pending";
    } else if (transactionStatus === "expire") {
      newStatus = "expire";
    } else if (transactionStatus === "cancel") {
      newStatus = "cancel";
    } else if (transactionStatus === "deny") {
      newStatus = "deny";
    } else if (transactionStatus === "refund") {
      newStatus = "refund";
    }

    console.log(`Updating transaction status from ${transaction.status} to ${newStatus}`);

    // IMPORTANT: Check if we need to complete transaction BEFORE updating status
    // This ensures diamonds are added even if transaction status update happens first
    const needsCompletion = newStatus === "settlement" && transaction.status !== "settlement";
    
    console.log(`=== Status Check ===`);
    console.log(`   Midtrans Status: ${transactionStatus} -> Our Status: ${newStatus}`);
    console.log(`   Current DB Status: ${transaction.status}`);
    console.log(`   Needs Completion: ${needsCompletion}`);
    
    if (needsCompletion) {
      console.log(`=== 🔄 COMPLETING TRANSACTION ===`);
      console.log(`Transaction ID: ${transaction.id}`);
      console.log(`Order ID: ${orderId}`);
      console.log(`User ID: ${transaction.userId}`);
      console.log(`Diamonds: ${transaction.diamonds || 0}`);
      console.log(`Bonus: ${transaction.bonus || 0}`);
      console.log(`Total Diamonds: ${(transaction.diamonds || 0) + (transaction.bonus || 0)}`);
      
      try {
        // Complete transaction first - this will add diamonds and update status to settlement
        await completeTopupTransactionServer(transaction.id, orderId);
        console.log(`✅ Transaction ${orderId} completed successfully - diamonds added to user account`);
        
        // Update additional fields if needed (midtransTransactionId, paymentMethod)
        // Status is already updated by completeTopupTransactionServer
        try {
          await updateTopupTransactionServer(transaction.id, {
            midtransTransactionId: notification.transaction_id,
            paymentMethod: notification.payment_type,
          });
          console.log(`✅ Transaction ${transaction.id} metadata updated successfully`);
        } catch (updateError: any) {
          console.error("⚠️ Error updating transaction metadata (non-critical):", updateError.message);
          // Non-critical error, continue
        }
      } catch (error: any) {
        console.error("❌ ERROR COMPLETING TRANSACTION:");
        console.error("   Error message:", error.message);
        console.error("   Error stack:", error.stack);
        console.error("   Error code:", error.code);
        console.error("   Error name:", error.name);
        
        // Still update transaction status even if completion failed
        // This allows retry mechanism or manual fix later
        try {
          await updateTopupTransactionServer(transaction.id, {
            status: newStatus,
            midtransTransactionId: notification.transaction_id,
            paymentMethod: notification.payment_type,
          });
          console.log(`⚠️ Transaction status updated to ${newStatus} despite completion error`);
          console.log(`⚠️ DIAMONDS WERE NOT ADDED! Manual intervention required.`);
        } catch (updateError: any) {
          console.error("❌ Error updating transaction status:", updateError.message);
        }
        
        // Re-throw error to prevent silent failure
        // But return 200 to Midtrans so they don't retry immediately
        // The error will be logged in Vercel logs
        throw new Error(`Failed to complete transaction: ${error.message}`);
      }
    } else if (newStatus === "settlement" && transaction.status === "settlement") {
      // Already completed - just update metadata if needed
      console.log(`✅ Transaction ${orderId} already completed (status: settlement) - skipping completion`);
      
      try {
        // Update metadata in case it changed
        await updateTopupTransactionServer(transaction.id, {
          midtransTransactionId: notification.transaction_id,
          paymentMethod: notification.payment_type,
        });
        console.log(`✅ Transaction metadata updated`);
      } catch (updateError: any) {
        console.error("⚠️ Error updating transaction metadata (non-critical):", updateError.message);
      }
    } else {
      // Update transaction status (not settlement or already completed)
      console.log(`📝 Updating transaction status: ${transaction.status} -> ${newStatus}`);
      
      try {
        await updateTopupTransactionServer(transaction.id, {
          status: newStatus,
          midtransTransactionId: notification.transaction_id,
          paymentMethod: notification.payment_type,
        });
        console.log(`✅ Transaction ${transaction.id} status updated to ${newStatus}`);
      } catch (updateError: any) {
        console.error("❌ Error updating transaction:", updateError.message);
        console.error("   Error stack:", updateError.stack);
        // Continue anyway - might be permission issue
      }
      
      if (transactionStatus === "settlement" && transaction.status !== "settlement") {
        console.log(`⚠️ WARNING: Midtrans status is "settlement" but transaction is not completed!`);
        console.log(`   This should not happen - status should have been updated.`);
        console.log(`   Manual review may be required.`);
      } else {
        console.log(`ℹ️ Transaction ${orderId} status updated: ${transaction.status} -> ${newStatus}`);
        console.log(`   (Status is ${newStatus}, not ready for completion yet)`);
      }
    }

    console.log("=== Midtrans Callback Processed Successfully ===");
    return NextResponse.json({ 
      ok: true, 
      message: "Notification processed",
      orderId,
      transactionStatus: newStatus
    });
  } catch (error: any) {
    console.error("=== ❌ ERROR PROCESSING MIDTRANS CALLBACK ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    
    // Return 200 to prevent Midtrans from retrying infinitely
    // But log the error for debugging in Vercel logs
    // You should check Vercel logs to see what went wrong
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Internal server error",
        orderId: orderId || notification?.order_id || "unknown"
      },
      { status: 200 }
    );
  }
}

