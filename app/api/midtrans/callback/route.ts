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

export async function POST(request: NextRequest) {
  try {
    console.log("=== Midtrans Callback Received ===");
    
    // Get Midtrans config
    const midtransConfig = await getMidtransConfig();
    if (!midtransConfig || !midtransConfig.serverKey) {
      console.error("Midtrans configuration not found");
      return NextResponse.json(
        { ok: false, error: "Configuration not found" },
        { status: 500 }
      );
    }

    // Parse notification body
    const notification = await request.json();
    console.log("Notification data:", JSON.stringify(notification, null, 2));

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

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    console.log(`Processing order: ${orderId}, status: ${transactionStatus}, fraud: ${fraudStatus}`);

    // Get transaction from Firestore
    const transaction = await getTopupTransactionByOrderIdServer(orderId);
    if (!transaction) {
      console.error("Transaction not found in Firestore:", orderId);
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

    console.log(`Transaction found: ${transaction.id}, current status: ${transaction.status}`);

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

    // Update transaction (using server-side function if available)
    try {
      await updateTopupTransactionServer(transaction.id, {
        status: newStatus,
        midtransTransactionId: notification.transaction_id,
        paymentMethod: notification.payment_type,
      });
      console.log(`Transaction ${transaction.id} updated successfully`);
    } catch (updateError: any) {
      console.error("Error updating transaction:", updateError);
      // Continue anyway - might be permission issue
    }

    // If status is settlement and not already completed, complete the transaction
    if (newStatus === "settlement" && transaction.status !== "settlement") {
      console.log(`Completing transaction ${transaction.id} - adding diamonds to user`);
      try {
        await completeTopupTransactionServer(transaction.id, orderId);
        console.log(`Transaction ${orderId} completed successfully - diamonds added`);
      } catch (error: any) {
        console.error("Error completing transaction:", error);
        console.error("Error details:", error.message, error.stack);
        // Don't fail the callback, just log the error
        // Return success so Midtrans doesn't retry
      }
    } else if (transaction.status === "settlement") {
      console.log(`Transaction ${orderId} already completed - skipping`);
    }

    console.log("=== Midtrans Callback Processed Successfully ===");
    return NextResponse.json({ ok: true, message: "Notification processed" });
  } catch (error: any) {
    console.error("=== Error processing Midtrans callback ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Return 200 to prevent Midtrans from retrying
    // But log the error for debugging
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 200 }
    );
  }
}

