import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

export interface Style {
  id: string;
  name: string;
  prompt: string;
  imageUrl: string;
  status: "Active" | "Inactive";
  category?: string;
  tags?: string[];
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface StyleFormData {
  name: string;
  prompt: string;
  imageUrl: string;
  status: "Active" | "Inactive";
  category?: string;
  tags?: string[];
}

// Get all styles
export const getStyles = async (): Promise<Style[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const stylesRef = collection(db, "styles");
    const q = query(stylesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Style[];
  } catch (error: any) {
    console.error("Error getting styles:", error);
    throw error;
  }
};

// Get active styles only (for public display)
// Note: We filter by status in Firestore, then sort by createdAt in client-side to avoid needing a composite index
export const getActiveStyles = async (): Promise<Style[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // Query only active styles (no orderBy to avoid composite index requirement)
    const stylesRef = collection(db, "styles");
    const q = query(stylesRef, where("status", "==", "Active"));
    const querySnapshot = await getDocs(q);

    // Map styles and sort by createdAt in client-side
    const styles = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          prompt: data.prompt,
          imageUrl: data.imageUrl,
          status: data.status,
          category: data.category || "",
          tags: data.tags || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
        } as Style;
      })
      .sort((a, b) => {
        // Sort by createdAt descending (newest first)
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt as any);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt as any);
        return dateB.getTime() - dateA.getTime();
      });

    return styles;
  } catch (error: any) {
    console.error("Error getting active styles:", error);
    // If query fails, try getting all styles and filter client-side
    try {
      const allStyles = await getStyles();
      return allStyles
        .filter((style) => style.status === "Active")
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt as any);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt as any);
          return dateB.getTime() - dateA.getTime();
        });
    } catch (fallbackError) {
      console.error("Error in fallback:", fallbackError);
      return [];
    }
  }
};

// Get single style by ID
export const getStyleById = async (id: string): Promise<Style | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const styleRef = doc(db, "styles", id);
    const styleSnap = await getDoc(styleRef);

    if (!styleSnap.exists()) {
      return null;
    }

    return {
      id: styleSnap.id,
      ...styleSnap.data(),
      createdAt: styleSnap.data().createdAt?.toDate() || new Date(),
      updatedAt: styleSnap.data().updatedAt?.toDate(),
    } as Style;
  } catch (error: any) {
    console.error("Error getting style:", error);
    throw error;
  }
};

// Create new style
export const createStyle = async (data: StyleFormData): Promise<string> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const stylesRef = collection(db, "styles");
    const docRef = await addDoc(stylesRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    console.error("Error creating style:", error);
    throw error;
  }
};

// Update style
export const updateStyle = async (
  id: string,
  data: Partial<StyleFormData>
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const styleRef = doc(db, "styles", id);
    await updateDoc(styleRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error updating style:", error);
    throw error;
  }
};

// Delete style
export const deleteStyle = async (id: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const styleRef = doc(db, "styles", id);
    await deleteDoc(styleRef);
  } catch (error: any) {
    console.error("Error deleting style:", error);
    throw error;
  }
};

// Delete all styles
export const deleteAllStyles = async (): Promise<number> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const stylesRef = collection(db, "styles");
    const querySnapshot = await getDocs(stylesRef);
    
    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    return querySnapshot.docs.length;
  } catch (error: any) {
    console.error("Error deleting all styles:", error);
    throw error;
  }
};

// Search styles
export const searchStyles = async (searchTerm: string): Promise<Style[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const stylesRef = collection(db, "styles");
    const q = query(
      stylesRef,
      where("name", ">=", searchTerm),
      where("name", "<=", searchTerm + "\uf8ff"),
      orderBy("name")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as Style[];
  } catch (error: any) {
    console.error("Error searching styles:", error);
    // If search fails, return all styles and filter client-side
    const allStyles = await getStyles();
    return allStyles.filter((style) =>
      style.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
};

// Get trending styles (most used styles)
export const getTrendingStyles = async (limit: number = 6): Promise<Style[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // Get all generations to count style usage
    const generationsRef = collection(db, "generations");
    const generationsSnapshot = await getDocs(generationsRef);

    // Count usage for each styleId
    const styleUsageCount: Record<string, number> = {};
    generationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const styleId = data.styleId;
      if (styleId) {
        styleUsageCount[styleId] = (styleUsageCount[styleId] || 0) + 1;
      }
    });

    // Get all active styles
    const activeStyles = await getActiveStyles();

    // Add usage count to each style and filter only styles that have been used
    const stylesWithUsage = activeStyles
      .map((style) => ({
        ...style,
        usageCount: styleUsageCount[style.id] || 0,
      }))
      .filter((style) => style.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map(({ usageCount, ...style }) => style); // Remove usageCount from result

    return stylesWithUsage;
  } catch (error: any) {
    console.error("Error getting trending styles:", error);
    // Fallback: return first 6 active styles if error occurs
    try {
      const activeStyles = await getActiveStyles();
      return activeStyles.slice(0, limit);
    } catch (fallbackError) {
      console.error("Error in fallback:", fallbackError);
      return [];
    }
  }
};

