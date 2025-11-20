/**
 * Server-side functions for feedback
 * These functions use Firebase Admin SDK (bypasses Firestore rules)
 * Use these in API routes for server-side operations
 */

import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";

let adminApp: App | null = null;

// Initialize Firebase Admin
function getAdminFirestore() {
  if (!adminApp) {
    try {
      // Try to initialize with service account from environment
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;

      if (serviceAccount && !getApps().length) {
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
      } else if (getApps().length > 0) {
        adminApp = getApps()[0];
      } else {
        // Fallback: Use client SDK if Admin SDK is not available
        return null;
      }
    } catch (error) {
      console.error("Error initializing Firebase Admin:", error);
      return null;
    }
  }

  return getFirestore(adminApp);
}

// Save feedback (server-side, bypasses rules if Admin SDK available)
export async function saveFeedbackServer(feedback: {
  userId: string;
  email: string;
  feedback: string;
  category: "general" | "bug" | "feature" | "beta-testing";
  isBetaTester: boolean;
  screenshotPath?: string | null;
  status?: "pending" | "reviewed" | "resolved";
}): Promise<string> {
  const adminDb = getAdminFirestore();

  if (!adminDb) {
    throw new Error(
      "Firebase Admin not configured. " +
      "Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable. " +
      "Alternatively, use client-side Firestore SDK with proper authentication."
    );
  }

  try {
    const feedbackRef = adminDb.collection("feedbacks").doc(`${feedback.userId}_${Date.now()}`);
    
    await feedbackRef.set({
      userId: feedback.userId,
      email: feedback.email,
      feedback: feedback.feedback,
      category: feedback.category,
      isBetaTester: feedback.isBetaTester,
      screenshotPath: feedback.screenshotPath || null,
      status: feedback.status || "pending",
      createdAt: new Date(),
    });

    return feedbackRef.id;
  } catch (error: any) {
    console.error("Error saving feedback:", error);
    throw error;
  }
}



