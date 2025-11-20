import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { getBetaTesterRegistrationEnabled } from "./settings";

/**
 * Check if a user is a beta tester
 * Also checks if registration is enabled - if disabled, returns false (badge should not show)
 * @param userId - The user ID to check
 * @returns Promise<boolean> - True if user is a beta tester AND registration is enabled, false otherwise
 */
export const isBetaTester = async (userId: string): Promise<boolean> => {
  if (!db || !userId) {
    return false;
  }

  try {
    // First check if registration is enabled
    const registrationEnabled = await getBetaTesterRegistrationEnabled();
    if (!registrationEnabled) {
      // If registration is disabled, don't show badge even if user is registered
      return false;
    }

    // Then check if user is registered as beta tester
    const betaTesterRef = doc(db, "betaTesters", userId);
    const betaTesterDoc = await getDoc(betaTesterRef);
    return betaTesterDoc.exists();
  } catch (error) {
    console.error("Error checking beta tester status:", error);
    return false;
  }
};

/**
 * Get beta tester data for a user
 * @param userId - The user ID to get data for
 * @returns Promise with beta tester data or null
 */
export const getBetaTesterData = async (userId: string) => {
  if (!db || !userId) {
    return null;
  }

  try {
    const betaTesterRef = doc(db, "betaTesters", userId);
    const betaTesterDoc = await getDoc(betaTesterRef);
    
    if (betaTesterDoc.exists()) {
      return betaTesterDoc.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting beta tester data:", error);
    return null;
  }
};

