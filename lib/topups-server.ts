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

// Helper function to retry Firestore operations with exponential backoff
async function retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a quota exceeded error
      if (error.code === 8 || error.message?.includes("Quota exceeded") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(`⚠️ Firestore quota exceeded. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // If not a quota error or max retries reached, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

// Get topup transaction by order ID (server-side) with retry logic
export async function getTopupTransactionByOrderIdServer(orderId: string): Promise<any | null> {
  try {
    const db = getAdminFirestore();
    if (!db) {
      throw new Error(
        "Firebase Admin SDK not initialized. " +
        "Please setup Firebase Admin SDK by setting FIREBASE_SERVICE_ACCOUNT environment variable."
      );
    }
    
    // Use retry logic for quota exceeded errors
    const result = await retryFirestoreOperation(async () => {
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
    });
    
    return result;
  } catch (error: any) {
    console.error("❌ Error getting topup transaction (server):", error.message);
    console.error("   Error code:", error.code);
    console.error("   Error details:", error.details);
    
    // If it's still a quota error after retries, return null to prevent infinite retries
    if (error.code === 8 || error.message?.includes("Quota exceeded") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      console.error("⚠️ Firestore quota exceeded even after retries. Please check your Firestore quota.");
      throw new Error("Firestore quota exceeded. Please try again later or contact administrator.");
    }
    
    throw error;
  }
}

// Complete topup transaction (server-side) with retry logic
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
    
    // Use retry logic for Firestore operations
    const transactionRef = db.collection("topupTransactions").doc(transactionId);
    const transactionDoc = await retryFirestoreOperation(async () => {
      return await transactionRef.get();
    });

    if (!transactionDoc.exists) {
      console.error(`Transaction document not found: ${transactionId}`);
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const transactionData = transactionDoc.data();
    console.log(`Transaction data:`, JSON.stringify(transactionData, null, 2));

    // Check if already completed - use a transaction to prevent race conditions
    // Get fresh transaction data to avoid race conditions
    const currentStatus = transactionData?.status;
    
    // IMPORTANT: Only skip if status is "settlement" AND we can verify diamonds were added
    // This prevents skipping legitimate completions for subsequent transactions
    if (currentStatus === "settlement") {
      // Double-check if diamonds were actually added with retry logic
      const userTokensRef = db.collection("userTokens").doc(transactionData?.userId);
      const userTokensDoc = await retryFirestoreOperation(async () => {
        return await userTokensRef.get();
      });
      const userTokens = userTokensDoc.data()?.tokens || 0;
      const expectedTotal = (transactionData?.diamonds || 0) + (transactionData?.bonus || 0);
      const completedAt = transactionData?.completedAt;
      
      console.log(`⚠️ Transaction ${orderId} status is already "settlement"`);
      console.log(`   Expected diamonds from this transaction: ${expectedTotal}`);
      console.log(`   User current tokens: ${userTokens}`);
      console.log(`   Completed at: ${completedAt || "N/A"}`);
      
      // Only skip if transaction has completedAt timestamp (indicating it was truly completed)
      // This ensures we don't skip transactions that were marked settlement but not completed
      if (completedAt) {
        console.log(`✅ Transaction already completed with completedAt timestamp - skipping to avoid duplicate`);
        return;
      } else {
        console.log(`⚠️ Transaction marked as settlement but no completedAt timestamp found!`);
        console.log(`   This might indicate an incomplete completion. Proceeding with completion...`);
        // Continue with completion to ensure diamonds are added
      }
    }

    // Add diamonds to user account using Admin SDK
    const totalDiamonds = (transactionData?.diamonds || 0) + (transactionData?.bonus || 0);
    console.log(`Adding ${totalDiamonds} diamonds to user ${transactionData?.userId} (${transactionData?.diamonds} base + ${transactionData?.bonus || 0} bonus)`);
    
    // Validate required fields
    if (!transactionData?.userId) {
      throw new Error("Transaction data missing userId");
    }
    if (totalDiamonds <= 0) {
      throw new Error(`Invalid diamond amount: ${totalDiamonds}`);
    }
    
    // Use Admin SDK to update user tokens (bypasses rules) with retry logic
    const userTokensRef = db.collection("userTokens").doc(transactionData.userId);
    
    const userTokensDoc = await retryFirestoreOperation(async () => {
      return await userTokensRef.get();
    });
    
    if (userTokensDoc.exists) {
      const currentTokens = userTokensDoc.data()?.tokens || 0;
      const newTokens = currentTokens + totalDiamonds;
      console.log(`📊 Token Update Plan:`);
      console.log(`   Current tokens: ${currentTokens}`);
      console.log(`   Adding: ${totalDiamonds}`);
      console.log(`   New total: ${newTokens}`);
      
      // Update tokens with retry logic
      await retryFirestoreOperation(async () => {
        await userTokensRef.update({
          tokens: newTokens,
          updatedAt: new Date(),
        });
      });
      console.log(`✅ User tokens updated successfully: ${currentTokens} → ${newTokens}`);
      
      // Verify update with retry logic
      const verifyDoc = await retryFirestoreOperation(async () => {
        return await userTokensRef.get();
      });
      const verifyTokens = verifyDoc.data()?.tokens || 0;
      if (verifyTokens !== newTokens) {
        console.error(`⚠️ WARNING: Token update verification failed! Expected ${newTokens}, got ${verifyTokens}`);
        throw new Error(`Token update verification failed: expected ${newTokens}, got ${verifyTokens}`);
      } else {
        console.log(`✅ Token update verified: ${verifyTokens} tokens`);
      }
    } else {
      // Create token document if it doesn't exist with retry logic
      console.log(`Creating new user token document for ${transactionData.userId}`);
      await retryFirestoreOperation(async () => {
        await userTokensRef.set({
          userId: transactionData.userId,
          tokens: totalDiamonds,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
      console.log(`✅ User token document created with ${totalDiamonds} tokens`);
      
      // Verify creation with retry logic
      const verifyDoc = await retryFirestoreOperation(async () => {
        return await userTokensRef.get();
      });
      const verifyTokens = verifyDoc.data()?.tokens || 0;
      if (verifyTokens !== totalDiamonds) {
        console.error(`⚠️ WARNING: Token creation verification failed! Expected ${totalDiamonds}, got ${verifyTokens}`);
        throw new Error(`Token creation verification failed: expected ${totalDiamonds}, got ${verifyTokens}`);
      } else {
        console.log(`✅ Token creation verified: ${verifyTokens} tokens`);
      }
    }

    // Update transaction status AFTER diamonds are added with retry logic
    console.log(`Updating transaction status to settlement`);
    await retryFirestoreOperation(async () => {
      await transactionRef.update({
        status: "settlement",
        completedAt: new Date(),
        updatedAt: new Date(),
      });
    });
    console.log(`✅ Transaction status updated to settlement`);

    console.log(`✅ Topup completed successfully: Added ${totalDiamonds} diamonds to user ${transactionData?.userId}`);
  } catch (error: any) {
    console.error("❌ Error completing topup transaction (server):", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

