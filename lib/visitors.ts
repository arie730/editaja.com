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

// Track a visitor (called from client-side)
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

    // Save to Firestore client-side (for real-time updates)
    // This is the primary tracking method
    try {
      const visitorRef = doc(db, "visitors", sessionId);
      const visitorSnap = await getDoc(visitorRef);

      if (visitorSnap.exists()) {
        // Update existing visitor
        await setDoc(
          visitorRef,
          {
            ...visitorData,
            lastSeenAt: serverTimestamp(),
            isActive: true,
          },
          { merge: true }
        );
      } else {
        // Create new visitor
        await setDoc(visitorRef, {
          ...visitorData,
          createdAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          isActive: true,
        });
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

// Subscribe to active visitors count (real-time)
export const subscribeToActiveVisitors = (
  callback: (count: number) => void
): (() => void) => {
  if (!db) {
    return () => {};
  }

  try {
    // Subscribe to all visitors and filter client-side
    const visitorsRef = collection(db, "visitors");
    
    const unsubscribe = onSnapshot(
      visitorsRef,
      (snapshot) => {
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
        callback(activeVisitors.length);
      },
      (error) => {
        console.error("Error subscribing to active visitors:", error);
        callback(0);
      }
    );

    return unsubscribe;
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

