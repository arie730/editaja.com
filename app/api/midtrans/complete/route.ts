import { NextRequest, NextResponse } from "next/server";
import { getTopupTransactionByOrderId, completeTopupTransaction } from "@/lib/topups";

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const idToken = authHeader.replace("Bearer ", "");

    // Verify Firebase token
    let userId: string;
    try {
      const verifyResponse = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!verifyResponse.ok) {
        throw new Error("Token verification failed");
      }

      const verifyData = await verifyResponse.json();
      if (!verifyData.users || verifyData.users.length === 0) {
        throw new Error("User not found");
      }

      userId = verifyData.users[0].localId;
    } catch (error: any) {
      console.error("Error verifying token:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Get transaction from Firestore
    const transaction = await getTopupTransactionByOrderId(orderId);
    
    if (!transaction) {
      return NextResponse.json(
        { ok: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify transaction belongs to user
    if (transaction.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Check if already completed
    if (transaction.status === "settlement") {
      return NextResponse.json({
        ok: true,
        message: "Transaction already completed",
        status: "settlement",
      });
    }

    // Complete the transaction (this will add diamonds to user account)
    // Note: completeTopupTransaction uses client SDK which requires user auth
    // Since we're in API route, we need to use server-side function or make it work differently
    try {
      // Try to use server-side function first
      let completed = false;
      try {
        const { completeTopupTransactionServer } = require("@/lib/topups-server");
        await completeTopupTransactionServer(transaction.id, orderId);
        completed = true;
      } catch (serverError) {
        // If server-side fails, try client-side (will work if user has permission)
        console.log("Server-side complete failed, trying client-side...");
        await completeTopupTransaction(transaction.id, orderId);
        completed = true;
      }
      
      if (completed) {
        return NextResponse.json({
          ok: true,
          message: "Transaction completed successfully",
          status: "settlement",
        });
      } else {
        throw new Error("Failed to complete transaction");
      }
    } catch (error: any) {
      console.error("Error completing transaction:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to complete transaction" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in complete transaction:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

