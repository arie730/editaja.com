import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { getInitialTokens, getTokenCostPerGenerate, getMaxAnonymousGenerations } from "./settings";

export interface UserTokenData {
  userId: string;
  tokens: number;
  createdAt?: any;
  updatedAt?: any;
}

// Initial tokens for new users
export const INITIAL_TOKENS = 100;

// Token cost per generation for logged-in users
export const TOKEN_COST_PER_GENERATE = 10;

// Maximum generations for anonymous users (default, will be overridden by settings)
export const MAX_ANONYMOUS_GENERATIONS = 1;

// Get user tokens
export const getUserTokens = async (userId: string): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    if (tokenSnap.exists()) {
      const data = tokenSnap.data();
      return data.tokens || 0;
    }

    // If user doesn't have token document, return 0 (should not happen for registered users)
    return 0;
  } catch (error: any) {
    console.error("Error getting user tokens:", error);
    throw error;
  }
};

// Initialize user tokens (called when user signs up)
export const initializeUserTokens = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    // Only initialize if token document doesn't exist
    if (!tokenSnap.exists()) {
      // Get initial tokens from settings (fallback to default)
      const initialTokens = await getInitialTokens();
      
      await setDoc(tokenRef, {
        userId: userId,
        tokens: initialTokens,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`Initialized ${initialTokens} tokens for user ${userId}`);
    }
  } catch (error: any) {
    console.error("Error initializing user tokens:", error);
    throw error;
  }
};

// Deduct tokens from user (client-side with Firestore rules validation)
export const deductUserTokens = async (userId: string, amount: number): Promise<boolean> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    // If token document doesn't exist, initialize it first
    let finalTokenSnap = tokenSnap;
    if (!tokenSnap.exists()) {
      console.warn(`Token document not found for user ${userId}, initializing...`);
      try {
        await initializeUserTokens(userId);
      } catch (initError) {
        console.error("Error initializing user tokens:", initError);
        throw new Error("User token document not found and could not be initialized");
      }
      // Re-fetch the document after initialization
      finalTokenSnap = await getDoc(tokenRef);
      if (!finalTokenSnap.exists()) {
        throw new Error("Failed to create user token document");
      }
    }

    const tokenData = finalTokenSnap.data();
    if (!tokenData) {
      throw new Error("Token document data is undefined");
    }
    const currentTokens = tokenData.tokens || 0;

    if (currentTokens < amount) {
      return false; // Insufficient tokens
    }

    // Update tokens using increment (atomic operation)
    // This works even if the document was just created
    await updateDoc(tokenRef, {
      tokens: increment(-amount),
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error: any) {
    console.error("Error deducting user tokens:", error);
    // Re-throw with more context
    if (error.code === "permission-denied") {
      throw new Error("Permission denied. Please ensure you are logged in and have sufficient tokens.");
    }
    throw error;
  }
};

// Add tokens to user (for admin to add tokens)
export const addUserTokens = async (userId: string, amount: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      // Create token document if it doesn't exist
      await setDoc(tokenRef, {
        userId: userId,
        tokens: amount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(tokenRef, {
        tokens: increment(amount),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error: any) {
    console.error("Error adding user tokens:", error);
    throw error;
  }
};

// Set user tokens (for admin to set tokens)
export const setUserTokens = async (userId: string, tokens: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      await setDoc(tokenRef, {
        userId: userId,
        tokens: tokens,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(tokenRef, {
        tokens: tokens,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error: any) {
    console.error("Error setting user tokens:", error);
    throw error;
  }
};

// Get user token data
export const getUserTokenData = async (userId: string): Promise<UserTokenData | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      return null;
    }

    const data = tokenSnap.data();
    return {
      userId: tokenSnap.id,
      tokens: data.tokens || 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error: any) {
    console.error("Error getting user token data:", error);
    throw error;
  }
};

// Re-export anonymous functions from anonymous.ts
export {
  getAnonymousGenerationCount,
  incrementAnonymousGenerationCount,
} from "./anonymous";
import { canAnonymousUserGenerate as canGenerate, getRemainingAnonymousGenerations as getRemaining } from "./anonymous";

// Check if anonymous user can generate (with max from settings)
export const canAnonymousUserGenerate = async (): Promise<boolean> => {
  const maxGenerations = await getMaxAnonymousGenerations();
  return canGenerate(maxGenerations);
};

// Get remaining anonymous generations (with max from settings)
export const getRemainingAnonymousGenerations = async (): Promise<number> => {
  const maxGenerations = await getMaxAnonymousGenerations();
  return getRemaining(maxGenerations);
};

