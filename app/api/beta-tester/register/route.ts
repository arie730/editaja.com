import { NextRequest, NextResponse } from "next/server";
import { getBetaTesterFreeTokens, getBetaTesterRegistrationEnabled } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    // Check if registration is enabled
    const registrationEnabled = await getBetaTesterRegistrationEnabled();
    if (!registrationEnabled) {
      return NextResponse.json(
        { ok: false, error: "Beta tester registration is currently disabled" },
        { status: 403 }
      );
    }

    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];

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
      console.error("Token verification error:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!userId || !userEmail) {
      return NextResponse.json(
        { ok: false, error: "Invalid user data" },
        { status: 400 }
      );
    }

    // Get free tokens amount
    const freeTokens = await getBetaTesterFreeTokens();

    // Use Firebase REST API to interact with Firestore
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "Firebase project ID not configured" },
        { status: 500 }
      );
    }

    // Check if user is already a beta tester using REST API
    const checkBetaTesterUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/betaTesters/${userId}`;
    const checkResponse = await fetch(checkBetaTesterUrl, {
      headers: {
        "Authorization": `Bearer ${idToken}`,
      },
    });

    if (checkResponse.ok) {
      return NextResponse.json(
        { ok: false, error: "You are already registered as a beta tester" },
        { status: 400 }
      );
    }

    // Register user as beta tester using REST API
    const betaTesterData = {
      fields: {
        userId: { stringValue: userId },
        email: { stringValue: userEmail },
        registeredAt: { timestampValue: new Date().toISOString() },
        freeTokensReceived: { integerValue: freeTokens.toString() },
      },
    };

    const createBetaTesterResponse = await fetch(checkBetaTesterUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(betaTesterData),
    });

    if (!createBetaTesterResponse.ok) {
      const errorData = await createBetaTesterResponse.json();
      console.error("Error creating beta tester:", errorData);
      throw new Error("Failed to register as beta tester");
    }

    // Get current tokens and add free tokens
    const userTokensUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/userTokens/${userId}`;
    const getTokensResponse = await fetch(userTokensUrl, {
      headers: {
        "Authorization": `Bearer ${idToken}`,
      },
    });

    let currentTokens = 0;
    if (getTokensResponse.ok) {
      const tokensData = await getTokensResponse.json();
      currentTokens = parseInt(tokensData.fields?.tokens?.integerValue || "0");
    }

    // Update user tokens
    const updateTokensData = {
      fields: {
        userId: { stringValue: userId },
        tokens: { integerValue: (currentTokens + freeTokens).toString() },
        updatedAt: { timestampValue: new Date().toISOString() },
        ...(currentTokens === 0 ? {
          createdAt: { timestampValue: new Date().toISOString() },
        } : {}),
      },
    };

    const updateTokensResponse = await fetch(userTokensUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateTokensData),
    });

    if (!updateTokensResponse.ok && updateTokensResponse.status !== 404) {
      const errorData = await updateTokensResponse.json();
      console.error("Error updating tokens:", errorData);
      // Don't throw error here, beta tester registration succeeded
    } else if (updateTokensResponse.status === 404) {
      // Create new document if it doesn't exist
      await fetch(userTokensUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateTokensData),
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully registered as beta tester! ${freeTokens} tokens have been added to your account.`,
      tokensReceived: freeTokens,
    });
  } catch (error: any) {
    console.error("Error registering beta tester:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to register as beta tester" },
      { status: 500 }
    );
  }
}

