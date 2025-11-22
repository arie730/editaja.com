import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";

export interface Visitor {
  id: string;
  sessionId: string;
  userId?: string; // If logged in
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  page: string;
  lastSeenAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  isActive: boolean;
}

// Track a visitor (called from client-side) - OPTIMIZED: No getDoc needed
export const trackVisitor = async (page: string, userId?: string): Promise<void> => {
  if (!db || typeof window === "undefined") {
    return;
  }

  try {
    // Get or create session ID
    let sessionId = sessionStorage.getItem("visitorSessionId");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("visitorSessionId", sessionId);
    }

    // Get visitor data
    const visitorData: Partial<Visitor> = {
      sessionId,
      page,
      lastSeenAt: serverTimestamp() as any,
      isActive: true,
    };

    if (userId) {
      visitorData.userId = userId;
    }

    // OPTIMIZED: Use setDoc with merge instead of getDoc + setDoc
    // This reduces 1 read operation per page load
    // merge: true will update existing or create new document
    try {
      const visitorRef = doc(db, "visitors", sessionId);
      
      // Check if this is first visit (by checking sessionStorage flag)
      const isFirstVisit = !sessionStorage.getItem(`visitor_${sessionId}_initialized`);
      
      await setDoc(
        visitorRef,
        {
          ...visitorData,
          ...(isFirstVisit ? { createdAt: serverTimestamp() as any } : {}),
          lastSeenAt: serverTimestamp() as any,
          isActive: true,
        },
        { merge: true }
      );
      
      // Mark as initialized to avoid redundant createdAt updates
      if (isFirstVisit) {
        sessionStorage.setItem(`visitor_${sessionId}_initialized`, "true");
      }
    } catch (firestoreError: any) {
      console.error("Error saving visitor to Firestore:", firestoreError);
      // Silently fail - visitor tracking is not critical
    }

    // Try to get IP and user agent from API (optional, non-blocking)
    // This is just for additional metadata, not required
    try {
      const response = await fetch("/api/visitor/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          page,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn("Visitor tracking API returned error:", errorData);
      }
    } catch (apiError) {
      // Silently fail - API tracking is optional
      console.warn("Visitor tracking API error (non-critical):", apiError);
    }
  } catch (error) {
    // Silently fail - visitor tracking should not break the app
    console.error("Error in trackVisitor:", error);
  }
};

// Get active visitors count (last 5 minutes)
export const getActiveVisitorsCount = async (): Promise<number> => {
  if (!db) {
    return 0;
  }

  try {
    // Get all visitors and filter client-side to avoid index requirement
    const visitorsRef = collection(db, "visitors");
    const snapshot = await getDocs(visitorsRef);
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const activeVisitors = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const lastSeenAt = data.lastSeenAt instanceof Date
        ? data.lastSeenAt
        : (data.lastSeenAt && typeof data.lastSeenAt.toDate === "function"
          ? data.lastSeenAt.toDate()
          : new Date(0));
      return lastSeenAt >= fiveMinutesAgo && data.isActive === true;
    });

    return activeVisitors.length;
  } catch (error) {
    console.error("Error getting active visitors count:", error);
    return 0;
  }
};

// Subscribe to active visitors count (real-time) - OPTIMIZED: Use polling instead of real-time listener
// Real-time listener on all visitors is VERY expensive (reads all documents on every update)
// Using polling with interval is much more quota-efficient
export const subscribeToActiveVisitors = (
  callback: (count: number) => void
): (() => void) => {
  if (!db) {
    return () => {};
  }

  try {
    // Use polling instead of real-time listener to save quota
    // Poll every 30 seconds instead of real-time listener
    const pollInterval = setInterval(async () => {
      try {
        const count = await getActiveVisitorsCount();
        callback(count);
      } catch (error) {
        console.error("Error polling active visitors:", error);
        callback(0);
      }
    }, 30000); // Poll every 30 seconds

    // Initial call
    getActiveVisitorsCount().then(callback).catch(() => callback(0));

    // Return cleanup function
    return () => {
      clearInterval(pollInterval);
    };
  } catch (error) {
    console.error("Error subscribing to active visitors:", error);
    return () => {};
  }
};

// Get total visitors today
export const getTodayVisitorsCount = async (): Promise<number> => {
  if (!db) {
    return 0;
  }

  try {
    // Get all visitors and filter client-side to avoid index requirement
    const visitorsRef = collection(db, "visitors");
    const snapshot = await getDocs(visitorsRef);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayVisitors = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Date
        ? data.createdAt
        : (data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate()
          : new Date(0));
      return createdAt >= today;
    });

    return todayVisitors.length;
  } catch (error) {
    console.error("Error getting today visitors count:", error);
    return 0;
  }
};

// Get total unique visitors (all time)
export const getTotalUniqueVisitors = async (): Promise<number> => {
  if (!db) {
    return 0;
  }

  try {
    const snapshot = await getCountFromServer(collection(db, "visitors"));
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting total unique visitors:", error);
    return 0;
  }
};

