import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { Style } from "./styles";

export interface Favorite {
  id: string;
  userId: string;
  styleId: string;
  style: Style;
  createdAt: Date | Timestamp;
}

// Add style to favorites
export const addFavorite = async (userId: string, styleId: string, style: Style): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoriteRef = doc(db, "favorites", `${userId}_${styleId}`);
    await setDoc(favoriteRef, {
      userId,
      styleId,
      style: {
        id: style.id,
        name: style.name,
        prompt: style.prompt,
        imageUrl: style.imageUrl,
        status: style.status,
        category: style.category,
        tags: style.tags,
      },
      createdAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error adding favorite:", error);
    throw error;
  }
};

// Remove style from favorites
export const removeFavorite = async (userId: string, styleId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoriteRef = doc(db, "favorites", `${userId}_${styleId}`);
    await deleteDoc(favoriteRef);
  } catch (error: any) {
    console.error("Error removing favorite:", error);
    throw error;
  }
};

// Check if style is favorited
export const isFavorite = async (userId: string, styleId: string): Promise<boolean> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoriteRef = doc(db, "favorites", `${userId}_${styleId}`);
    const favoriteSnap = await getDoc(favoriteRef);
    return favoriteSnap.exists();
  } catch (error: any) {
    console.error("Error checking favorite:", error);
    return false;
  }
};

// Get all favorites for a user
export const getUserFavorites = async (userId: string): Promise<Favorite[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoritesRef = collection(db, "favorites");
    const q = query(favoritesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        styleId: data.styleId,
        style: data.style as Style,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Favorite;
    });
  } catch (error: any) {
    console.error("Error getting user favorites:", error);
    throw error;
  }
};

// Get favorite style IDs for a user (for quick checking)
export const getUserFavoriteStyleIds = async (userId: string): Promise<string[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoritesRef = collection(db, "favorites");
    const q = query(favoritesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data().styleId);
  } catch (error: any) {
    console.error("Error getting favorite style IDs:", error);
    return [];
  }
};





