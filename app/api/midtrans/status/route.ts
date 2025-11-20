import { NextRequest, NextResponse } from "next/server";
import { getTopupTransactionByOrderId } from "@/lib/topups";
import { auth } from "@/lib/firebase";

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");

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

    return NextResponse.json({
      ok: true,
      status: transaction.status,
      orderId: transaction.orderId,
      diamonds: transaction.diamonds,
      bonus: transaction.bonus || 0,
      price: transaction.price,
    });
  } catch (error: any) {
    console.error("Error getting payment status:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



