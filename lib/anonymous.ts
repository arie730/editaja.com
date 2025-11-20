// Anonymous user management with server-side tracking
import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";

// Generate anonymous user ID based on browser fingerprint
export const getAnonymousUserId = (): string => {
  if (typeof window === "undefined") {
    return "anonymous";
  }

  // Check if we already have an ID stored
  try {
    const storedId = localStorage.getItem("anonymousUserId");
    if (storedId) {
      return storedId;
    }
  } catch (error) {
    console.error("Error reading anonymousUserId from localStorage:", error);
  }

  // Generate a consistent ID based on browser characteristics
  // This will be the same across tabs/windows in the same browser
  const fingerprint = generateBrowserFingerprint();
  
  // Store it for consistency
  try {
    localStorage.setItem("anonymousUserId", fingerprint);
  } catch (error) {
    console.error("Error storing anonymousUserId:", error);
  }
  
  return fingerprint;
};

// Generate browser fingerprint
const generateBrowserFingerprint = (): string => {
  if (typeof window === "undefined") {
    return "anonymous";
  }

  const components: string[] = [];
  
  // User agent
  if (navigator.userAgent) {
    components.push(navigator.userAgent);
  }
  
  // Screen resolution
  if (window.screen) {
    components.push(`${window.screen.width}x${window.screen.height}`);
    components.push(`${window.screen.colorDepth}`);
  }
  
  // Timezone
  if (Intl.DateTimeFormat) {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
  
  // Language
  if (navigator.language) {
    components.push(navigator.language);
  }
  
  // Platform
  if (navigator.platform) {
    components.push(navigator.platform);
  }
  
  // Canvas fingerprint (more stable)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Anonymous", 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch (error) {
    // Canvas fingerprinting might be blocked, skip it
  }
  
  // Create hash from components
  const combined = components.join("|");
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Create anonymous ID (without timestamp to ensure consistency)
  // Store in localStorage for persistence
  return `anon_${Math.abs(hash).toString(36)}`;
};

// Get today's date string in YYYY-MM-DD format (UTC)
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get anonymous user generation count for today from Firestore
export const getAnonymousGenerationCount = async (): Promise<number> => {
  if (!db) {
    return 0;
  }

  try {
    const anonymousId = getAnonymousUserId();
    const todayDate = getTodayDateString();
    const userRef = doc(db, "anonymousUsers", anonymousId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastGeneratedDate = data.lastGeneratedDate || "";
      
      // If last generated date is today, return today's count
      // Otherwise, count resets (return 0)
      if (lastGeneratedDate === todayDate) {
        return data.todayGenerationCount || 0;
      }
      
      // Different day, reset count
      return 0;
    }

    return 0;
  } catch (error) {
    console.error("Error getting anonymous generation count:", error);
    return 0;
  }
};

// Increment anonymous user generation count in Firestore (per day)
export const incrementAnonymousGenerationCount = async (): Promise<number> => {
  if (!db) {
    return 0;
  }

  try {
    const anonymousId = getAnonymousUserId();
    const todayDate = getTodayDateString();
    const userRef = doc(db, "anonymousUsers", anonymousId);
    const userSnap = await getDoc(userRef);

    let newCount: number;

    if (userSnap.exists()) {
      const data = userSnap.data();
      const lastGeneratedDate = data.lastGeneratedDate || "";
      
      if (lastGeneratedDate === todayDate) {
        // Same day, increment today's count
        await updateDoc(userRef, {
          todayGenerationCount: increment(1),
          lastGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        newCount = (data.todayGenerationCount || 0) + 1;
      } else {
        // New day, reset count to 1
        await updateDoc(userRef, {
          todayGenerationCount: 1,
          lastGeneratedDate: todayDate,
          lastGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        
        newCount = 1;
      }
    } else {
      // Create new document
      await setDoc(userRef, {
        anonymousId: anonymousId,
        todayGenerationCount: 1,
        lastGeneratedDate: todayDate,
        firstSeenAt: serverTimestamp(),
        lastGeneratedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      newCount = 1;
    }

    return newCount;
  } catch (error) {
    console.error("Error incrementing anonymous generation count:", error);
    return 0;
  }
};

// Check if anonymous user can generate
export const canAnonymousUserGenerate = async (maxGenerations: number): Promise<boolean> => {
  try {
    const count = await getAnonymousGenerationCount();
    return count < maxGenerations;
  } catch (error) {
    console.error("Error checking anonymous generation limit:", error);
    return false;
  }
};

// Get remaining anonymous generations
export const getRemainingAnonymousGenerations = async (maxGenerations: number): Promise<number> => {
  try {
    const count = await getAnonymousGenerationCount();
    return Math.max(0, maxGenerations - count);
  } catch (error) {
    console.error("Error getting remaining anonymous generations:", error);
    return 0;
  }
};

