import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(request: NextRequest) {
  try {
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
    } catch (error: any) {
      console.error("Token verification error:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check if Firestore is initialized
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "Database not initialized" },
        { status: 500 }
      );
    }

    // Check if user is already a beta tester
    const betaTesterRef = doc(db, "betaTesters", userId);
    const betaTesterDoc = await getDoc(betaTesterRef);

    return NextResponse.json({
      ok: true,
      isRegistered: betaTesterDoc.exists(),
    });
  } catch (error: any) {
    console.error("Error checking beta tester status:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to check beta tester status" },
      { status: 500 }
    );
  }
}

