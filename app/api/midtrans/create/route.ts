import { NextRequest, NextResponse } from "next/server";
import { getMidtransConfig } from "@/lib/settings";
import { saveTopupTransactionServer } from "@/lib/topups-server";

// Midtrans API base URL
const getMidtransBaseUrl = (isProduction: boolean) => {
  return isProduction
    ? "https://api.midtrans.com"
    : "https://app.sandbox.midtrans.com";
};

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

    // Verify Firebase token by calling Firebase REST API
    let userId: string;
    let userEmail: string | undefined;
    
    try {
      // Verify token using Firebase REST API
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
      userEmail = verifyData.users[0].email;
    } catch (error: any) {
      console.error("Error verifying token:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token. Please login again." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { packageId, diamonds, bonus, price } = body;

    if (!packageId || !diamonds || !price) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get Midtrans config
    const midtransConfig = await getMidtransConfig();
    if (!midtransConfig || !midtransConfig.serverKey || !midtransConfig.clientKey) {
      return NextResponse.json(
        { ok: false, error: "Midtrans configuration not found. Please configure in admin settings." },
        { status: 500 }
      );
    }

    // Generate order ID
    const orderId = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Save transaction to Firestore (using server-side function)
    let transactionId: string;
    try {
      console.log(`Saving transaction to Firestore: orderId=${orderId}, userId=${userId}`);
      transactionId = await saveTopupTransactionServer({
        userId,
        userEmail,
        packageId,
        diamonds,
        bonus: bonus || 0,
        price,
        status: "pending",
        orderId,
      });
      console.log(`Transaction saved successfully: transactionId=${transactionId}, orderId=${orderId}`);
    } catch (error: any) {
      // If Admin SDK is not available, we can't save transaction server-side
      // In this case, we'll still create the payment token but transaction won't be saved
      // Client should save it after payment success
      console.error("Failed to save transaction (Admin SDK may not be configured):", error);
      console.error("Error details:", error.message, error.stack);
      
      // For now, we'll use a temporary ID
      // In production, you should setup Firebase Admin SDK
      transactionId = `temp-${orderId}`;
      
      // Log warning but continue with payment creation
      console.warn("Transaction not saved to Firestore. Setup Firebase Admin SDK for full functionality.");
      console.warn("Payment will be created but callback won't be able to update transaction status.");
    }

    // Prepare Midtrans payment request
    const midtransBaseUrl = getMidtransBaseUrl(midtransConfig.isProduction);
    const paymentData = {
      transaction_details: {
        order_id: orderId,
        gross_amount: price,
      },
      item_details: [
        {
          id: packageId,
          price: price,
          quantity: 1,
          name: `${diamonds} Diamonds${bonus ? ` + ${bonus} Bonus` : ""}`,
        },
      ],
      customer_details: {
        email: userEmail || `${userId}@example.com`,
      },
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://editaja.com"}/topup/success`,
        error: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://editaja.com"}/topup/error`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://editaja.com"}/topup/pending`,
      },
      // Add notification URL for server-to-server callback
      notification_urls: [
        `${process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://editaja.com"}/api/midtrans/callback`,
      ],
    };

    // Create payment token via Midtrans API
    const response = await fetch(`${midtransBaseUrl}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(midtransConfig.serverKey + ":").toString("base64")}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Midtrans API error:", errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to create payment. Please try again." },
        { status: 500 }
      );
    }

    const midtransResponse = await response.json();

    return NextResponse.json({
      ok: true,
      token: midtransResponse.token,
      orderId,
      transactionId,
      clientKey: midtransConfig.clientKey,
      isProduction: midtransConfig.isProduction,
    });
  } catch (error: any) {
    console.error("Error creating Midtrans payment:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

