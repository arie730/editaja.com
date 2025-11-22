import { NextRequest, NextResponse } from "next/server";
import { getTopupTransactionByOrderIdServer } from "@/lib/topups-server";
import { getMidtransConfig } from "@/lib/settings";
import crypto from "crypto";

/**
 * Endpoint untuk retry transaction yang gagal karena quota exceeded
 * Bisa dipanggil manual atau scheduled
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    console.log(`=== Retrying Failed Transaction ===`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Get transaction from Firestore
    let transaction: any = null;
    try {
      transaction = await getTopupTransactionByOrderIdServer(orderId);
    } catch (error: any) {
      if (error.message?.includes("quota exceeded") || error.code === 8) {
        console.error("❌ Firestore quota still exceeded. Please try again later.");
        return NextResponse.json(
          { 
            ok: false, 
            error: "Firestore quota still exceeded. Please wait and try again later.",
            retryAfter: 3600 // 1 hour
          },
          { status: 503 } // Service Unavailable
        );
      }
      throw error;
    }

    if (!transaction) {
      return NextResponse.json(
        { ok: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    console.log(`Transaction found: ${transaction.id}, status: ${transaction.status}`);

    // Check if transaction needs completion
    if (transaction.status === "settlement") {
      console.log(`Transaction already completed`);
      return NextResponse.json({
        ok: true,
        message: "Transaction already completed",
        status: "settlement"
      });
    }

    // Get fresh status from Midtrans
    const midtransConfig = await getMidtransConfig();
    if (!midtransConfig || !midtransConfig.serverKey) {
      return NextResponse.json(
        { ok: false, error: "Midtrans configuration not found" },
        { status: 500 }
      );
    }

    const midtransBaseUrl = midtransConfig.isProduction
      ? "https://api.midtrans.com"
      : "https://app.sandbox.midtrans.com";

    // Check transaction status from Midtrans
    const statusResponse = await fetch(
      `${midtransBaseUrl}/v2/${orderId}/status`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(midtransConfig.serverKey + ":").toString("base64")}`,
        },
      }
    );

    if (!statusResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to get transaction status from Midtrans" },
        { status: 500 }
      );
    }

    const midtransData = await statusResponse.json();
    const transactionStatus = midtransData.transaction_status;

    console.log(`Midtrans status: ${transactionStatus}`);

    // If status is settlement, complete the transaction
    if (transactionStatus === "settlement") {
      // Import and call completeTopupTransactionServer
      const { completeTopupTransactionServer } = await import("@/lib/topups-server");
      
      try {
        await completeTopupTransactionServer(transaction.id, orderId);
        console.log(`✅ Transaction ${orderId} completed successfully`);
        
        return NextResponse.json({
          ok: true,
          message: "Transaction completed successfully",
          orderId,
          status: "settlement"
        });
      } catch (error: any) {
        console.error("❌ Error completing transaction:", error.message);
        
        if (error.message?.includes("quota exceeded") || error.code === 8) {
          return NextResponse.json(
            { 
              ok: false, 
              error: "Firestore quota exceeded. Please try again later.",
              retryAfter: 3600
            },
            { status: 503 }
          );
        }
        
        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Transaction status is ${transactionStatus}, not ready for completion`,
      status: transactionStatus
    });

  } catch (error: any) {
    console.error("❌ Error retrying transaction:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Internal server error"
      },
      { status: 500 }
    );
  }
}

// Allow GET for easy manual retry
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "Order ID is required. Use ?orderId=TOPUP-xxx" },
      { status: 400 }
    );
  }

  // Convert GET to POST
  const response = await POST(
    new NextRequest(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    })
  );

  return response;
}


