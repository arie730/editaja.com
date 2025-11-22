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
      console.log(`=== SAVING TRANSACTION TO FIRESTORE ===`);
      console.log(`Order ID: ${orderId}`);
      console.log(`User ID: ${userId}`);
      console.log(`User Email: ${userEmail || "N/A"}`);
      console.log(`Package ID: ${packageId}`);
      console.log(`Diamonds: ${diamonds}`);
      console.log(`Bonus: ${bonus || 0}`);
      console.log(`Price: ${price}`);
      
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
      console.log(`✅ Transaction saved successfully: transactionId=${transactionId}, orderId=${orderId}`);
      console.log(`=== TRANSACTION SAVE COMPLETE ===`);
    } catch (error: any) {
      // CRITICAL: If Admin SDK is not available, transaction cannot be saved
      // This means callback won't be able to find transaction and add diamonds!
      console.error("❌ CRITICAL ERROR: Failed to save transaction to Firestore");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("⚠️ This means:");
      console.error("  1. Payment will be created in Midtrans");
      console.error("  2. BUT callback won't find transaction in Firestore");
      console.error("  3. AND diamonds won't be added to user account");
      console.error("");
      console.error("🔧 SOLUTION: Setup Firebase Admin SDK");
      console.error("  - Set FIREBASE_SERVICE_ACCOUNT environment variable in Vercel");
      console.error("  - See FIREBASE-ADMIN-SETUP.md for instructions");
      console.error("");
      
      // Return error - don't continue without saving transaction
      return NextResponse.json(
        { 
          ok: false, 
          error: "Failed to save transaction. Please contact administrator. Error: " + error.message,
          details: "Firebase Admin SDK may not be configured. Check server logs for details."
        },
        { status: 500 }
      );
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

