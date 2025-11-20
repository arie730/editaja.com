import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { saveFeedbackServer } from "@/lib/feedback-server";

export async function POST(request: NextRequest) {
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
    let userEmail: string | undefined;
    
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
      userEmail = verifyData.users[0].email;
    } catch (error: any) {
      console.error("Token verification error:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const feedback = formData.get("feedback") as string;
    const category = formData.get("category") as string;
    const isBetaTester = formData.get("isBetaTester") === "true";
    const screenshot = formData.get("screenshot") as File | null;

    if (!feedback || !category) {
      return NextResponse.json(
        { ok: false, error: "Feedback and category are required" },
        { status: 400 }
      );
    }

    // Handle screenshot upload if provided
    let screenshotPath: string | undefined;
    if (screenshot && screenshot.size > 0) {
      // Validate file type
      if (!screenshot.type.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "Screenshot must be an image file" },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB)
      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: "Screenshot size must be less than 5MB" },
          { status: 400 }
        );
      }

      // Create feedback directory if it doesn't exist
      const feedbackDir = path.join(process.cwd(), "public", "uploads", "feedback");
      if (!existsSync(feedbackDir)) {
        await mkdir(feedbackDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExtension = screenshot.name.split(".").pop() || "jpg";
      const filename = `feedback_${timestamp}_${randomStr}.${fileExtension}`;
      const filePath = path.join(feedbackDir, filename);

      // Convert file to buffer and save
      const bytes = await screenshot.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Store relative path
      screenshotPath = `/uploads/feedback/${filename}`;
    }

    // Save feedback to Firestore
    let feedbackId: string;
    
    try {
      // Try using Admin SDK first (bypasses rules)
      feedbackId = await saveFeedbackServer({
        userId: userId,
        email: userEmail || "",
        feedback: feedback,
        category: category as "general" | "bug" | "feature" | "beta-testing",
        isBetaTester: isBetaTester,
        screenshotPath: screenshotPath || null,
        status: "pending",
      });
    } catch (adminError: any) {
      // If Admin SDK is not available, use Firebase REST API with user token
      // This will respect Firestore security rules
      console.log("Admin SDK not available, using Firebase REST API with user token");
      
      const feedbackDocId = `${userId}_${Date.now()}`;
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      
      if (!projectId) {
        throw new Error("Firebase project ID not configured");
      }

      // Use Firebase REST API to write document
      // Note: This requires the user to be authenticated and have permission according to Firestore rules
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/feedbacks/${feedbackDocId}`;
      
      // Format data according to Firestore REST API format
      const documentData: any = {
        fields: {
          userId: { stringValue: userId },
          email: { stringValue: userEmail || "" },
          feedback: { stringValue: feedback },
          category: { stringValue: category },
          isBetaTester: { booleanValue: isBetaTester },
          status: { stringValue: "pending" },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      };

      // Add screenshotPath if exists
      if (screenshotPath) {
        documentData.fields.screenshotPath = { stringValue: screenshotPath };
      } else {
        documentData.fields.screenshotPath = { nullValue: null };
      }

      const firestoreResponse = await fetch(firestoreUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(documentData),
      });

      if (!firestoreResponse.ok) {
        const errorData = await firestoreResponse.json().catch(() => ({}));
        console.error("Firestore REST API error:", errorData);
        throw new Error(
          `Failed to save feedback: ${firestoreResponse.statusText}. ` +
          `Make sure Firestore security rules allow authenticated users to create feedbacks.`
        );
      }

      feedbackId = feedbackDocId;
    }

    return NextResponse.json({
      ok: true,
      message: "Feedback submitted successfully",
      feedbackId: feedbackId,
    });
  } catch (error: any) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

