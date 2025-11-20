import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Initialize Firebase for server-side
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { ok: false, error: "API key is required" },
        { status: 400 }
      );
    }

    // Test the API key by making a simple request
    try {
      const response = await fetch(
        "https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-freepik-api-key": apiKey.trim(),
          },
          body: JSON.stringify({
            prompt: "test image",
          }),
        }
      );

      // Check if API key is valid (not unauthorized or forbidden)
      // Status 400 (Bad Request) is acceptable as it means API key is valid but request is invalid
      // Status 401/403 means invalid API key
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          ok: false,
          valid: false,
          message: "Invalid API key. Please check your API key.",
        });
      }

      // Any other status means API key format is likely valid
      return NextResponse.json({
        ok: true,
        valid: true,
        message: "API key is valid!",
      });
    } catch (error: any) {
      console.error("Error testing API connection:", error);
      return NextResponse.json({
        ok: false,
        valid: false,
        message: error.message || "Failed to test connection. Please check your network.",
      });
    }
  } catch (error: any) {
    console.error("Error in test API:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

