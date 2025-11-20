import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { GenerationData } from "./storage";

export interface Generation extends GenerationData {
  id: string;
  createdAt: Date | Timestamp;
  location?: {
    country?: string;
    city?: string;
    ip?: string;
  };
}

// Get all generations (admin only)
export const getGenerations = async (): Promise<Generation[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    // Get all generations without orderBy to avoid index requirement
    // We'll sort in client-side instead
    const querySnapshot = await getDocs(generationsRef);

    const generations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        styleId: data.styleId || "",
        styleName: data.styleName || "",
        originalImageUrl: data.originalImageUrl || "",
        generatedImageUrls: data.generatedImageUrls || [],
        createdAt: data.createdAt || new Date(),
        location: data.location || undefined,
      } as Generation;
    });

    // Sort by createdAt in client-side (descending)
    return generations.sort((a, b) => {
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
    console.error("Error getting generations:", error);
    throw error;
  }
};

// Get generations by style
export const getGenerationsByStyle = async (styleName: string): Promise<Generation[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    // Only use where clause to avoid composite index requirement
    // We'll sort in client-side instead
    const q = query(generationsRef, where("styleName", "==", styleName));
    const querySnapshot = await getDocs(q);

    const generations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        styleId: data.styleId || "",
        styleName: data.styleName || "",
        originalImageUrl: data.originalImageUrl || "",
        generatedImageUrls: data.generatedImageUrls || [],
        createdAt: data.createdAt || new Date(),
        location: data.location || undefined,
      } as Generation;
    });

    // Sort by createdAt in client-side (descending)
    return generations.sort((a, b) => {
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
    console.error("Error getting generations by style:", error);
    throw error;
  }
};

// Get generations by user ID
export const getGenerationsByUserId = async (userId: string): Promise<Generation[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    // Only use where clause to avoid composite index requirement
    // We'll sort in client-side instead
    const q = query(generationsRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    const generations = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        styleId: data.styleId || "",
        styleName: data.styleName || "",
        originalImageUrl: data.originalImageUrl || "",
        generatedImageUrls: data.generatedImageUrls || [],
        createdAt: data.createdAt || new Date(),
        location: data.location || undefined,
      } as Generation;
    });

    // Sort by createdAt in client-side (descending)
    return generations.sort((a, b) => {
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
    console.error("Error getting generations by user ID:", error);
    throw error;
  }
};

// Get all unique style names from generations
export const getStyleNamesFromGenerations = async (): Promise<string[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    const querySnapshot = await getDocs(generationsRef);
    
    const styleNames = new Set<string>();
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.styleName) {
        styleNames.add(data.styleName);
      }
    });

    return Array.from(styleNames).sort();
  } catch (error: any) {
    console.error("Error getting style names:", error);
    throw error;
  }
};

// Delete generation (admin only)
export const deleteGeneration = async (generationId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // Get generation data first to extract image URLs
    const generationRef = doc(db, "generations", generationId);
    const generationSnap = await getDoc(generationRef);
    
    if (!generationSnap.exists()) {
      throw new Error("Generation not found");
    }

    const generationData = generationSnap.data();
    const userId = generationData.userId || "";
    
    // Delete images from gambar.editaja.com
    const imageUrls: string[] = [];
    
    // Add original image URL if it's from gambar.editaja.com
    if (generationData.originalImageUrl && generationData.originalImageUrl.includes("gambar.editaja.com")) {
      imageUrls.push(generationData.originalImageUrl);
    }
    
    // Add generated image URLs if they're from gambar.editaja.com
    if (Array.isArray(generationData.generatedImageUrls)) {
      generationData.generatedImageUrls.forEach((url: string) => {
        if (url && url.includes("gambar.editaja.com")) {
          imageUrls.push(url);
        }
      });
    }

    // Delete all images from gambar.editaja.com in parallel
    if (imageUrls.length > 0) {
      const deleteImagePromises = imageUrls.map(async (imageUrl) => {
        try {
          const deleteResponse = await fetch("/api/admin/delete-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              imageUrl,
              userId 
            }),
          });

          if (deleteResponse.ok) {
            const deleteData = await deleteResponse.json();
            console.log("✅ Image deleted from gambar.editaja.com:", deleteData);
          } else {
            const errorData = await deleteResponse.json().catch(() => ({}));
            console.warn("⚠️ Failed to delete image from gambar.editaja.com:", errorData);
          }
        } catch (error: any) {
          console.warn("⚠️ Error deleting image from gambar.editaja.com:", error.message);
          // Continue even if image deletion fails
        }
      });

      await Promise.allSettled(deleteImagePromises);
    }

    // Delete the generation document from Firestore
    await deleteDoc(generationRef);
    console.log("Generation deleted successfully:", generationId);
  } catch (error: any) {
    console.error("Error deleting generation:", error);
    throw error;
  }
};

// Delete generation by user (user can delete their own generations)
export const deleteGenerationByUser = async (generationId: string, userId: string): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    // First verify that the generation belongs to the user
    const generationRef = doc(db, "generations", generationId);
    const generationSnap = await getDoc(generationRef);
    
    if (!generationSnap.exists()) {
      throw new Error("Generation not found");
    }
    
    const generationData = generationSnap.data();
    if (generationData.userId !== userId) {
      throw new Error("You don't have permission to delete this generation");
    }
    
    // Delete the generation
    await deleteDoc(generationRef);
    console.log("Generation deleted successfully by user:", generationId);
  } catch (error: any) {
    console.error("Error deleting generation:", error);
    throw error;
  }
};

