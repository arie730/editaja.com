import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, orderBy, deleteDoc } from "firebase/firestore";

// Get AI API key from Firestore
export const getAiApiKey = async (): Promise<string | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "ai");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    const data = settingsSnap.data();
    return data.apiKey || null;
  } catch (error: any) {
    console.error("Error getting AI API key:", error);
    throw error;
  }
};

// Backward compatibility - alias for getAiApiKey
export const getFreepikApiKey = getAiApiKey;

// Save AI API key to Firestore
export const saveAiApiKey = async (apiKey: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "ai");
    await setDoc(
      settingsRef,
      {
        apiKey: apiKey,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving AI API key:", error);
    throw error;
  }
};

// Backward compatibility - alias for saveAiApiKey
export const saveFreepikApiKey = saveAiApiKey;

// Test AI API connection (using API route to avoid CORS issues)
export const testAiConnection = async (apiKey: string): Promise<{ valid: boolean; message: string }> => {
  try {
    const response = await fetch("/api/ai/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey }),
    });

    const data = await response.json();

    if (!data.ok) {
      return {
        valid: false,
        message: data.message || data.error || "Failed to test connection",
      };
    }

    return {
      valid: data.valid || false,
      message: data.message || (data.valid ? "Connection test successful!" : "Connection test failed"),
    };
  } catch (error: any) {
    console.error("Error testing AI connection:", error);
    return {
      valid: false,
      message: error.message || "Failed to test connection. Please check your network.",
    };
  }
};

// Backward compatibility - alias for testAiConnection
export const testFreepikConnection = testAiConnection;

// Theme Colors Interface
export interface ThemeColors {
  primary: string;
  backgroundLight: string;
  backgroundDark: string;
}

// Get theme colors from Firestore
export const getThemeColors = async (): Promise<ThemeColors | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "theme");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    const data = settingsSnap.data();
    return {
      primary: data.primary || "#0d0df2",
      backgroundLight: data.backgroundLight || "#f5f5f8",
      backgroundDark: data.backgroundDark || "#111118",
    };
  } catch (error: any) {
    console.error("Error getting theme colors:", error);
    throw error;
  }
};

// Save theme colors to Firestore
export const saveThemeColors = async (colors: ThemeColors): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "theme");
    await setDoc(
      settingsRef,
      {
        ...colors,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving theme colors:", error);
    throw error;
  }
};

// Get initial tokens for new users from Firestore
export const getInitialTokens = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default value if not set
      return 100;
    }

    const data = settingsSnap.data();
    return data.initialTokens || 100;
  } catch (error: any) {
    console.error("Error getting initial tokens:", error);
    // Return default value on error
    return 100;
  }
};

// Save initial tokens for new users to Firestore
export const saveInitialTokens = async (initialTokens: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (initialTokens < 0) {
    throw new Error("Initial tokens cannot be negative");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    await setDoc(
      settingsRef,
      {
        initialTokens: initialTokens,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving initial tokens:", error);
    throw error;
  }
};

// Get token cost per generation from Firestore
export const getTokenCostPerGenerate = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default value if not set
      return 10;
    }

    const data = settingsSnap.data();
    return data.tokenCostPerGenerate || 10;
  } catch (error: any) {
    console.error("Error getting token cost per generate:", error);
    // Return default value on error
    return 10;
  }
};

// Save token cost per generation to Firestore
export const saveTokenCostPerGenerate = async (tokenCost: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (tokenCost < 0) {
    throw new Error("Token cost cannot be negative");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    await setDoc(
      settingsRef,
      {
        tokenCostPerGenerate: tokenCost,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving token cost per generate:", error);
    throw error;
  }
};

// Get max anonymous generations from Firestore
export const getMaxAnonymousGenerations = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default value if not set
      return 1;
    }

    const data = settingsSnap.data();
    return data.maxAnonymousGenerations || 1;
  } catch (error: any) {
    console.error("Error getting max anonymous generations:", error);
    // Return default value on error
    return 1;
  }
};

// Save max anonymous generations to Firestore
export const saveMaxAnonymousGenerations = async (maxGenerations: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (maxGenerations < 0) {
    throw new Error("Max anonymous generations cannot be negative");
  }

  try {
    const settingsRef = doc(db, "settings", "tokens");
    await setDoc(
      settingsRef,
      {
        maxAnonymousGenerations: maxGenerations,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving max anonymous generations:", error);
    throw error;
  }
};

// Midtrans Configuration Interface
export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
}

// Get Midtrans configuration from Firestore
export const getMidtransConfig = async (): Promise<MidtransConfig | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "midtrans");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    const data = settingsSnap.data();
    return {
      serverKey: data.serverKey || "",
      clientKey: data.clientKey || "",
      isProduction: data.isProduction || false,
    };
  } catch (error: any) {
    console.error("Error getting Midtrans config:", error);
    throw error;
  }
};

// Save Midtrans configuration to Firestore
export const saveMidtransConfig = async (config: MidtransConfig): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (!config.serverKey || !config.clientKey) {
    throw new Error("Server key and client key are required");
  }

  try {
    const settingsRef = doc(db, "settings", "midtrans");
    await setDoc(
      settingsRef,
      {
        serverKey: config.serverKey,
        clientKey: config.clientKey,
        isProduction: config.isProduction || false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving Midtrans config:", error);
    throw error;
  }
};

// Beta Tester Settings

// Get beta tester free tokens from Firestore
export const getBetaTesterFreeTokens = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default value if not set
      return 1000;
    }

    const data = settingsSnap.data();
    return data.freeTokens || 1000;
  } catch (error: any) {
    console.error("Error getting beta tester free tokens:", error);
    // Return default value on error
    return 1000;
  }
};

// Save beta tester free tokens to Firestore
export const saveBetaTesterFreeTokens = async (freeTokens: number): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (freeTokens < 0) {
    throw new Error("Free tokens cannot be negative");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    await setDoc(
      settingsRef,
      {
        freeTokens: freeTokens,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving beta tester free tokens:", error);
    throw error;
  }
};

// Get beta tester registration enabled status from Firestore
export const getBetaTesterRegistrationEnabled = async (): Promise<boolean> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default value if not set (enabled by default)
      return true;
    }

    const data = settingsSnap.data();
    return data.registrationEnabled !== false; // Default to true if not set
  } catch (error: any) {
    console.error("Error getting beta tester registration enabled:", error);
    // Return default value on error
    return true;
  }
};

// Save beta tester registration enabled status to Firestore
export const saveBetaTesterRegistrationEnabled = async (enabled: boolean): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    await setDoc(
      settingsRef,
      {
        registrationEnabled: enabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving beta tester registration enabled:", error);
    throw error;
  }
};

// Get max beta testers from Firestore
export const getMaxBetaTesters = async (): Promise<number | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return null if not set (no limit)
      return null;
    }

    const data = settingsSnap.data();
    return data.maxBetaTesters || null;
  } catch (error: any) {
    console.error("Error getting max beta testers:", error);
    // Return null on error (no limit)
    return null;
  }
};

// Save max beta testers to Firestore
export const saveMaxBetaTesters = async (maxBetaTesters: number | null): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (maxBetaTesters !== null && maxBetaTesters < 0) {
    throw new Error("Max beta testers cannot be negative");
  }

  try {
    const settingsRef = doc(db, "settings", "betaTester");
    await setDoc(
      settingsRef,
      {
        maxBetaTesters: maxBetaTesters,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving max beta testers:", error);
    throw error;
  }
};

// General Settings Interface
export interface GeneralSettings {
  websiteName: string;
  logoPath?: string | null;
  faviconPath?: string | null;
  watermarkEnabled?: boolean;
}

// Get general settings from Firestore
export const getGeneralSettings = async (): Promise<GeneralSettings> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "general");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default values
      return {
        websiteName: "edit Aja",
        logoPath: null,
        faviconPath: null,
        watermarkEnabled: true, // Default enabled
      };
    }

    const data = settingsSnap.data();
    return {
      websiteName: data.websiteName || "edit Aja",
      logoPath: data.logoPath || null,
      faviconPath: data.faviconPath || null,
      watermarkEnabled: data.watermarkEnabled !== undefined ? data.watermarkEnabled : true, // Default enabled
    };
  } catch (error: any) {
    console.error("Error getting general settings:", error);
    throw error;
  }
};

// Save general settings to Firestore
export const saveGeneralSettings = async (settings: GeneralSettings): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (!settings.websiteName || settings.websiteName.trim() === "") {
    throw new Error("Website name cannot be empty");
  }

  try {
    const settingsRef = doc(db, "settings", "general");
    await setDoc(
      settingsRef,
      {
        websiteName: settings.websiteName.trim(),
        logoPath: settings.logoPath || null,
        faviconPath: settings.faviconPath || null,
        watermarkEnabled: settings.watermarkEnabled !== undefined ? settings.watermarkEnabled : true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving general settings:", error);
    throw error;
  }
};

// Top Up Plans Interface
export interface TopupPlan {
  id: string;
  diamonds: number;
  price: number;
  anchorPrice?: number;
  bonus?: number;
  popular?: boolean;
  order?: number; // For sorting
}

// Get topup plans from Firestore
export const getTopupPlans = async (): Promise<TopupPlan[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const plansRef = collection(db, "topupPlans");
    const plansSnapshot = await getDocs(query(plansRef, orderBy("order", "asc")));

    if (plansSnapshot.empty) {
      // Return default plans if none exist
      return [
        { id: "1", diamonds: 100, price: 10000, anchorPrice: 15000, bonus: 0, popular: false, order: 1 },
        { id: "2", diamonds: 250, price: 22500, anchorPrice: 37500, bonus: 25, popular: true, order: 2 },
        { id: "3", diamonds: 500, price: 40000, anchorPrice: 75000, bonus: 100, popular: false, order: 3 },
      ];
    }

    return plansSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as TopupPlan[];
  } catch (error: any) {
    console.error("Error getting topup plans:", error);
    throw error;
  }
};

// Save topup plan to Firestore
export const saveTopupPlan = async (plan: TopupPlan): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  if (plan.diamonds <= 0) {
    throw new Error("Diamonds must be greater than 0");
  }

  if (plan.price <= 0) {
    throw new Error("Price must be greater than 0");
  }

  if (plan.anchorPrice && plan.anchorPrice <= plan.price) {
    throw new Error("Anchor price must be greater than price");
  }

  try {
    const planRef = doc(db, "topupPlans", plan.id);
    await setDoc(
      planRef,
      {
        diamonds: plan.diamonds,
        price: plan.price,
        anchorPrice: plan.anchorPrice || null,
        bonus: plan.bonus || 0,
        popular: plan.popular || false,
        order: plan.order || 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving topup plan:", error);
    throw error;
  }
};

// Delete topup plan from Firestore
export const deleteTopupPlan = async (planId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const planRef = doc(db, "topupPlans", planId);
    await deleteDoc(planRef);
  } catch (error: any) {
    console.error("Error deleting topup plan:", error);
    throw error;
  }
};

// Social Media Settings Interface
export interface SocialMediaSettings {
  facebook: boolean;
  twitter: boolean;
  whatsapp: boolean;
  telegram: boolean;
  linkedin: boolean;
  pinterest: boolean;
}

// Get social media settings from Firestore
export const getSocialMediaSettings = async (): Promise<SocialMediaSettings> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "socialMedia");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      // Return default values (all enabled)
      return {
        facebook: true,
        twitter: true,
        whatsapp: true,
        telegram: true,
        linkedin: true,
        pinterest: true,
      };
    }

    const data = settingsSnap.data();
    return {
      facebook: data.facebook !== false, // Default to true
      twitter: data.twitter !== false,
      whatsapp: data.whatsapp !== false,
      telegram: data.telegram !== false,
      linkedin: data.linkedin !== false,
      pinterest: data.pinterest !== false,
    };
  } catch (error: any) {
    console.error("Error getting social media settings:", error);
    // Return default values on error
    return {
      facebook: true,
      twitter: true,
      whatsapp: true,
      telegram: true,
      linkedin: true,
      pinterest: true,
    };
  }
};

// Save social media settings to Firestore
export const saveSocialMediaSettings = async (settings: SocialMediaSettings): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const settingsRef = doc(db, "settings", "socialMedia");
    await setDoc(
      settingsRef,
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error("Error saving social media settings:", error);
    throw error;
  }
};

