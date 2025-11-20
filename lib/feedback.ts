import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp, updateDoc, deleteDoc } from "firebase/firestore";

export interface Feedback {
  id: string;
  userId: string;
  email: string;
  feedback: string;
  category: "general" | "bug" | "feature" | "beta-testing";
  isBetaTester: boolean;
  screenshotPath?: string;
  status: "pending" | "reviewed" | "resolved";
  isRead?: boolean;
  readAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  adminNotes?: string;
}

// Get all feedbacks (admin only)
export const getAllFeedbacks = async (): Promise<Feedback[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbacksRef = collection(db, "feedbacks");
    const q = query(feedbacksRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Feedback[];
  } catch (error: any) {
    console.error("Error getting feedbacks:", error);
    throw error;
  }
};

// Get feedbacks by category
export const getFeedbacksByCategory = async (category: string): Promise<Feedback[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbacksRef = collection(db, "feedbacks");
    const q = query(
      feedbacksRef,
      where("category", "==", category),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Feedback[];
  } catch (error: any) {
    console.error("Error getting feedbacks by category:", error);
    throw error;
  }
};

// Get feedback by ID
export const getFeedbackById = async (feedbackId: string): Promise<Feedback | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbackRef = doc(db, "feedbacks", feedbackId);
    const feedbackDoc = await getDoc(feedbackRef);

    if (!feedbackDoc.exists()) {
      return null;
    }

    return {
      id: feedbackDoc.id,
      ...feedbackDoc.data(),
      createdAt: feedbackDoc.data().createdAt?.toDate() || new Date(),
      updatedAt: feedbackDoc.data().updatedAt?.toDate(),
    } as Feedback;
  } catch (error: any) {
    console.error("Error getting feedback:", error);
    throw error;
  }
};

// Get user's own feedbacks
export const getUserFeedbacks = async (userId: string): Promise<Feedback[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbacksRef = collection(db, "feedbacks");
    const q = query(
      feedbacksRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Feedback[];
  } catch (error: any) {
    console.error("Error getting user feedbacks:", error);
    throw error;
  }
};

// Get count of unread feedbacks (isRead !== true)
export const getUnreadFeedbackCount = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbacksRef = collection(db, "feedbacks");
    // Get all feedbacks and filter client-side since Firestore doesn't support != null queries easily
    const querySnapshot = await getDocs(feedbacksRef);
    
    // Count feedbacks where isRead is not true
    const unreadCount = querySnapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.isRead !== true;
    }).length;

    return unreadCount;
  } catch (error: any) {
    console.error("Error getting unread feedback count:", error);
    // Return 0 on error to prevent UI issues
    return 0;
  }
};

// Mark feedback as read
export const markFeedbackAsRead = async (feedbackId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbackRef = doc(db, "feedbacks", feedbackId);
    await updateDoc(feedbackRef, {
      isRead: true,
      readAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error marking feedback as read:", error);
    throw error;
  }
};

// Delete feedback
export const deleteFeedback = async (feedbackId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const feedbackRef = doc(db, "feedbacks", feedbackId);
    await deleteDoc(feedbackRef);
  } catch (error: any) {
    console.error("Error deleting feedback:", error);
    throw error;
  }
};


