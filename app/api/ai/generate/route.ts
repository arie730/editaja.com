import { NextRequest, NextResponse } from "next/server";
import { AI_ENDPOINT_CREATE, pollAiResult } from "@/lib/ai";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
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

// Initialize Firebase for server-side
let app: FirebaseApp;
try {
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized for server-side");
  } else {
    app = apps[0]!; // Non-null assertion: getApps() always returns valid array
  }
} catch (error: any) {
  console.error("Error initializing Firebase:", error);
  throw error;
}

export async function POST(request: NextRequest) {
  try {
    console.log("Image generation API called");
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const styleId = formData.get("styleId") as string;
    const stylePrompt = formData.get("stylePrompt") as string;
    const userId = formData.get("userId") as string;

    console.log("Received data:", {
      hasImage: !!imageFile,
      imageSize: imageFile?.size,
      styleId,
      hasPrompt: !!stylePrompt,
      userId,
    });

    if (!imageFile) {
      console.error("No image file provided");
      return NextResponse.json(
        { ok: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    if (!styleId || !stylePrompt) {
      console.error("Missing style data:", { styleId, hasPrompt: !!stylePrompt });
      return NextResponse.json(
        { ok: false, error: "Style ID and prompt are required" },
        { status: 400 }
      );
    }

    // Get API key - try environment variable first, then Firestore
    let apiKey: string | null = null;
    
    // Try environment variable first (for server-side, more secure)
    if (process.env.AI_API_KEY || process.env.FREEPIK_API_KEY) {
      apiKey = process.env.AI_API_KEY || process.env.FREEPIK_API_KEY || null;
      console.log("Using API key from environment variable");
    } else {
      // Fallback to Firestore (requires rules to allow read)
      console.log("Getting API key from Firestore...");
      try {
        const db = getFirestore(app);
        const settingsRef = doc(db, "settings", "ai");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          apiKey = settingsSnap.data()?.apiKey;
          console.log("API key from Firestore:", !!apiKey, "Length:", apiKey?.length);
        }
      } catch (firestoreError: any) {
        console.error("Error reading from Firestore:", firestoreError);
        // Continue to check if apiKey is set
      }
    }
    
    if (!apiKey || apiKey === "YOUR_AI_API_KEY" || apiKey.trim() === "") {
      console.error("API key is empty or not set");
      return NextResponse.json(
        { ok: false, error: "AI API key not configured. Please set AI_API_KEY in environment variables or in admin settings." },
        { status: 500 }
      );
    }

    // Convert image to base64
    console.log("Converting image to base64...");
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    console.log("Base64 image length:", base64Image.length);

    // Build prompt with style
    const size = "2160x3840 pixels";
    const desc = "vertical 9:16";
    const ratioInstruction = `Generate the image strictly in ${desc} aspect ratio, full ${size} resolution. Do not crop, stretch, pad, or add borders. Keep the exact ratio.\n\n`;
    const prompt = ratioInstruction + stylePrompt;
    console.log("Prompt length:", prompt.length);

    // Prepare payload
    const payload: any = {
      prompt: prompt,
      reference_images: [base64Image],
    };

    // Call image generation API
    console.log("Calling image generation service...");
    const createResponse = await fetch(AI_ENDPOINT_CREATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-freepik-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    console.log("Image generation service response status:", createResponse.status);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Image generation service error:", errorText);
      return NextResponse.json(
        { ok: false, error: `Image generation service error (${createResponse.status}): ${errorText.substring(0, 200)}` },
        { status: createResponse.status }
      );
    }

    const createJson = await createResponse.json();
    console.log("Image generation service response:", { hasData: !!createJson.data, taskId: createJson?.data?.task_id });
    const taskId = createJson?.data?.task_id;

    if (!taskId) {
      console.error("No task_id in response:", createJson);
      return NextResponse.json(
        { ok: false, error: "No task_id received from AI service", raw: createJson },
        { status: 500 }
      );
    }

    // Poll for result
    console.log("Polling for result, taskId:", taskId);
    const pollResult = await pollAiResult(taskId, apiKey, 90, 3);
    console.log("Poll result:", { ok: pollResult.ok, hasUrls: !!pollResult.urls, error: pollResult.error });

    if (pollResult.ok && pollResult.urls) {
      console.log("Success! Generated", pollResult.urls.length, "images");
      return NextResponse.json({
        ok: true,
        urls: pollResult.urls,
        taskId: taskId,
        status: pollResult.json?.data?.status || "COMPLETED",
      });
    } else {
      console.error("Poll failed:", pollResult.error);
      return NextResponse.json(
        {
          ok: false,
          error: pollResult.error || "Failed to generate image",
          raw: pollResult.json,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in image generation API:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

