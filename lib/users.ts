import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { getGenerationsByUserId } from "./generations";
import { deleteImage } from "./storage";

export interface User {
  id: string;
  email: string;
  createdAt: Date | Timestamp;
  totalGenerations?: number;
}

// Get all users from Firestore
export const getUsers = async (): Promise<User[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const usersRef = collection(db, "users");
    // Get all users without orderBy to avoid index requirement
    // We'll sort in client-side instead
    const querySnapshot = await getDocs(usersRef);

    const users = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || "",
        createdAt: data.createdAt || new Date(),
      } as User;
    });

    // Sort by createdAt in client-side (descending)
    return users.sort((a, b) => {
      const dateA = a.createdAt instanceof Date 
        ? a.createdAt 
        : (a.createdAt && typeof a.createdAt.toDate === "function" 
          ? a.createdAt.toDate() 
          : new Date(0));
      const dateB = b.createdAt instanceof Date 
        ? b.createdAt 
        : (b.createdAt && typeof b.createdAt.toDate === "function" 
          ? b.createdAt.toDate() 
          : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error: any) {
    console.error("Error getting users:", error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      id: userSnap.id,
      email: data.email || "",
      createdAt: data.createdAt || new Date(),
    } as User;
  } catch (error: any) {
    console.error("Error getting user:", error);
    throw error;
  }
};

// Get users with generation count (including anonymous users from generations)
export const getUsersWithGenerationCount = async (): Promise<User[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const users = await getUsers();
    
    // Get all admin IDs to filter them out
    let adminIds = new Set<string>();
    try {
      const adminsRef = collection(db, "admins");
      const adminsSnapshot = await getDocs(adminsRef);
      adminsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.isAdmin === true) {
          adminIds.add(doc.id);
        }
      });
    } catch (error) {
      // If we can't read admins collection, log but continue
      // This might happen if rules don't allow reading, but we'll continue anyway
      console.warn("Could not read admins collection to filter them out:", error);
    }
    
    // Get all generations to find unique user IDs and count generations
    const generationsRef = collection(db, "generations");
    const generationsSnapshot = await getDocs(generationsRef);
    
    // Count generations per user ID
    const userGenerationCounts = new Map<string, number>();
    const userIdsFromGenerations = new Set<string>();
    
    generationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.userId) {
        userIdsFromGenerations.add(data.userId);
        userGenerationCounts.set(
          data.userId,
          (userGenerationCounts.get(data.userId) || 0) + 1
        );
      }
    });

    // Create a map of existing users (excluding admins)
    const usersMap = new Map<string, User>();
    users.forEach((user) => {
      // Skip admin users
      if (!adminIds.has(user.id)) {
        usersMap.set(user.id, {
          ...user,
          totalGenerations: userGenerationCounts.get(user.id) || 0,
        });
      }
    });

    // Add users from generations that don't exist in users collection
    // (excluding admins and anonymous)
    userIdsFromGenerations.forEach((userId) => {
      if (!usersMap.has(userId) && !adminIds.has(userId)) {
        // This is an anonymous user or user not in users collection
        usersMap.set(userId, {
          id: userId,
          email: userId === "anonymous" ? "Anonymous User" : "No email",
          createdAt: new Date(),
          totalGenerations: userGenerationCounts.get(userId) || 0,
        });
      }
    });

    // Convert map to array and sort
    const usersWithCounts = Array.from(usersMap.values());

    // Sort by total generations (descending) then by email
    return usersWithCounts.sort((a, b) => {
      if (b.totalGenerations !== a.totalGenerations) {
        return (b.totalGenerations || 0) - (a.totalGenerations || 0);
      }
      return (a.email || "").localeCompare(b.email || "");
    });
  } catch (error: any) {
    console.error("Error getting users with generation count:", error);
    throw error;
  }
};

// Get total generations for a user
export const getUserTotalGenerations = async (userId: string): Promise<number> => {
  try {
    const generations = await getGenerationsByUserId(userId);
    return generations.length;
  } catch (error: any) {
    console.error("Error getting user total generations:", error);
    return 0;
  }
};

// Delete all user favorites
export const deleteUserFavorites = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const favoritesRef = collection(db, "favorites");
    const q = query(favoritesRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error: any) {
    console.error("Error deleting user favorites:", error);
    throw error;
  }
};

// Delete all user generations and their images
export const deleteUserGenerations = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generations = await getGenerationsByUserId(userId);
    
    // Delete all images from storage
    const imageDeletePromises: Promise<void>[] = [];
    
    for (const generation of generations) {
      // Delete original image
      if (generation.originalImageUrl) {
        try {
          // Check if it's a storage URL (contains firebasestorage.googleapis.com)
          if (generation.originalImageUrl.includes("firebasestorage.googleapis.com") || 
              generation.originalImageUrl.includes("/storage/")) {
            imageDeletePromises.push(deleteImage(generation.originalImageUrl));
          }
        } catch (error) {
          console.error("Error deleting original image:", error);
          // Continue even if image deletion fails
        }
      }
      
      // Delete generated images
      if (generation.generatedImageUrls && generation.generatedImageUrls.length > 0) {
        for (const url of generation.generatedImageUrls) {
          try {
            // Check if it's a storage URL
            if (url.includes("firebasestorage.googleapis.com") || url.includes("/storage/")) {
              imageDeletePromises.push(deleteImage(url));
            }
          } catch (error) {
            console.error("Error deleting generated image:", error);
            // Continue even if image deletion fails
          }
        }
      }
    }
    
    // Delete all images in parallel
    await Promise.allSettled(imageDeletePromises);
    
    // Delete all generation documents
    const generationsRef = collection(db, "generations");
    const q = query(generationsRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error: any) {
    console.error("Error deleting user generations:", error);
    throw error;
  }
};

// Delete user tokens
export const deleteUserTokens = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const tokenRef = doc(db, "userTokens", userId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (tokenSnap.exists()) {
      await deleteDoc(tokenRef);
    }
  } catch (error: any) {
    console.error("Error deleting user tokens:", error);
    throw error;
  }
};

// Delete user from Firestore and all related data
export const deleteUser = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // Delete all user data in parallel
    await Promise.all([
      deleteUserFavorites(userId),
      deleteUserGenerations(userId),
      deleteUserTokens(userId),
    ]);

    // Delete user folders from gambar.editaja.com
    try {
      const deleteImagesResponse = await fetch("/api/admin/delete-user-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (deleteImagesResponse.ok) {
        const deleteData = await deleteImagesResponse.json();
        console.log("✅ User folders deleted from gambar.editaja.com:", deleteData);
      } else {
        const errorData = await deleteImagesResponse.json().catch(() => ({}));
        console.warn("⚠️ Failed to delete user folders from gambar.editaja.com:", errorData);
        // Continue even if folder deletion fails - user data is already deleted from Firestore
      }
    } catch (imageDeleteError: any) {
      console.warn("⚠️ Error deleting user folders from gambar.editaja.com:", imageDeleteError.message);
      // Continue even if folder deletion fails - user data is already deleted from Firestore
    }

    // Finally delete the user document
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
  } catch (error: any) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

