/**
 * Server-side functions for topup transactions
 * These functions use Firebase Admin SDK (bypasses Firestore rules)
 * Use these in API routes for webhook callbacks and server-side operations
 */

import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { addUserTokens } from "./tokens";

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
        // This will use Firestore client SDK which requires proper auth
        return null;
      }
    } catch (error) {
      console.error("Error initializing Firebase Admin:", error);
      return null;
    }
  }

  return getFirestore(adminApp);
}

// Save topup transaction (server-side, bypasses rules if Admin SDK available)
export async function saveTopupTransactionServer(transaction: {
  userId: string;
  userEmail?: string;
  packageId: string;
  diamonds: number;
  bonus?: number;
  price: number;
  status: "pending" | "settlement" | "expire" | "cancel" | "deny" | "refund";
  orderId: string;
}): Promise<string> {
  const db = getAdminFirestore();
  
  if (!db) {
    throw new Error(
      "Firebase Admin SDK not initialized. " +
      "Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable. " +
      "See: https://firebase.google.com/docs/admin/setup"
    );
  }

  try {
    const transactionsRef = db.collection("topupTransactions");
    const newDocRef = transactionsRef.doc();
    
    await newDocRef.set({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newDocRef.id;
  } catch (error: any) {
    console.error("Error saving topup transaction (server):", error);
    throw new Error(`Failed to save transaction: ${error.message}`);
  }
}

// Update topup transaction (server-side, bypasses rules)
export async function updateTopupTransactionServer(
  transactionId: string,
  updates: {
    status?: "pending" | "settlement" | "expire" | "cancel" | "deny" | "refund";
    midtransTransactionId?: string;
    paymentMethod?: string;
    completedAt?: any;
  }
): Promise<void> {
  try {
    const db = getAdminFirestore();
    if (!db) {
      throw new Error(
        "Firebase Admin SDK not initialized. " +
        "Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable."
      );
    }
    const transactionRef = db.collection("topupTransactions").doc(transactionId);
    
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    // If status is settlement, set completedAt
    if (updates.status === "settlement" && !updates.completedAt) {
      updateData.completedAt = new Date();
    }

    await transactionRef.update(updateData);
  } catch (error: any) {
    console.error("Error updating topup transaction (server):", error);
    throw error;
  }
}

// Get topup transaction by order ID (server-side)
export async function getTopupTransactionByOrderIdServer(orderId: string): Promise<any | null> {
  try {
    const db = getAdminFirestore();
    if (!db) {
      throw new Error(
        "Firebase Admin SDK not initialized. " +
        "Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable."
      );
    }
    const snapshot = await db
      .collection("topupTransactions")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error: any) {
    console.error("Error getting topup transaction (server):", error);
    throw error;
  }
}

// Complete topup transaction (server-side)
export async function completeTopupTransactionServer(
  transactionId: string,
  orderId: string
): Promise<void> {
  try {
    console.log(`Starting transaction completion: transactionId=${transactionId}, orderId=${orderId}`);
    
    const db = getAdminFirestore();
    if (!db) {
      const errorMsg = "Firebase Admin SDK not initialized. Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable.";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const transactionRef = db.collection("topupTransactions").doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      console.error(`Transaction document not found: ${transactionId}`);
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const transactionData = transactionDoc.data();
    console.log(`Transaction data:`, JSON.stringify(transactionData, null, 2));

    // Check if already completed
    if (transactionData?.status === "settlement") {
      console.log(`Transaction ${orderId} already completed - skipping`);
      return;
    }

    // Add diamonds to user account using Admin SDK
    const totalDiamonds = (transactionData?.diamonds || 0) + (transactionData?.bonus || 0);
    console.log(`Adding ${totalDiamonds} diamonds to user ${transactionData?.userId} (${transactionData?.diamonds} + ${transactionData?.bonus || 0} bonus)`);
    
    // Use Admin SDK to update user tokens (bypasses rules)
    const userTokensRef = db.collection("userTokens").doc(transactionData?.userId);
    const userTokensDoc = await userTokensRef.get();
    
    if (userTokensDoc.exists) {
      const currentTokens = userTokensDoc.data()?.tokens || 0;
      const newTokens = currentTokens + totalDiamonds;
      console.log(`Updating user tokens: ${currentTokens} + ${totalDiamonds} = ${newTokens}`);
      await userTokensRef.update({
        tokens: newTokens,
        updatedAt: new Date(),
      });
      console.log(`User tokens updated successfully`);
    } else {
      // Create token document if it doesn't exist
      console.log(`Creating new user token document for ${transactionData?.userId}`);
      await userTokensRef.set({
        userId: transactionData?.userId,
        tokens: totalDiamonds,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`User token document created with ${totalDiamonds} tokens`);
    }

    // Update transaction status
    console.log(`Updating transaction status to settlement`);
    await transactionRef.update({
      status: "settlement",
      completedAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Transaction status updated successfully`);

    console.log(`✅ Topup completed successfully: Added ${totalDiamonds} diamonds to user ${transactionData?.userId}`);
  } catch (error: any) {
    console.error("❌ Error completing topup transaction (server):", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

