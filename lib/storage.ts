import { storage, db } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Interface for generation data saved to Firestore
 */
export interface GenerationData {
  userId: string;
  styleId: string;
  styleName: string;
  originalImageUrl: string;
  generatedImageUrls: string[];
  location?: {
    country?: string;
    city?: string;
    ip?: string;
  };
}

/**
 * Upload an image file to Firebase Storage
 * @param file - The file to upload
 * @param path - The storage path (e.g., "styles/preview.jpg")
 * @returns The download URL of the uploaded file
 */
export const uploadImage = async (
  file: File,
  path: string
): Promise<string> => {
  if (!storage) {
    throw new Error("Firebase Storage not initialized");
  }

  try {
    // Create a reference to the file location
    const storageRef = ref(storage, path);

    // Upload the file
    await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading image:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Delete an image from Firebase Storage or local server
 * @param url - The storage URL of the file to delete
 */
export const deleteImage = async (url: string): Promise<void> => {
  try {
    // Check if it's a Firebase Storage URL
    if (url.includes("firebasestorage.googleapis.com")) {
      if (!storage) {
        throw new Error("Firebase Storage not initialized");
      }

      // Extract the path from the URL
      const urlObj = new URL(url);
      const path = decodeURIComponent(
        urlObj.pathname.split("/o/")[1]?.split("?")[0] || ""
      );

      if (!path) {
        throw new Error("Invalid storage URL");
      }

      // Create a reference to the file
      const storageRef = ref(storage, path);

      // Delete the file
      await deleteObject(storageRef);
    } else if (url.includes("/api/upload") || url.startsWith("/uploads/") || url.includes("localhost") || url.includes("127.0.0.1")) {
      // It's a local server file, try to delete via API
      try {
        const response = await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          console.warn("Failed to delete local file:", url);
          // Don't throw error, just log warning
        }
      } catch (error) {
        console.warn("Error deleting local file:", error);
        // Don't throw error, just log warning
      }
    } else {
      // Unknown URL format, skip deletion
      console.warn("Unknown URL format, skipping deletion:", url);
    }
  } catch (error: any) {
    console.error("Error deleting image:", error);
    // Don't throw error, just log it - we want to continue deleting other files
    console.warn(`Failed to delete image: ${url}`);
  }
};

/**
 * Generate a unique path for style preview images
 * @param styleId - Optional style ID (for updates)
 * @param fileName - Original file name
 * @returns Storage path
 */
export const getStyleImagePath = (
  styleId?: string,
  fileName?: string
): string => {
  const timestamp = Date.now();
  const id = styleId || `temp_${timestamp}`;
  const extension = fileName?.split(".").pop() || "jpg";
  return `styles/${id}_${timestamp}.${extension}`;
};

/**
 * Upload an image to gambar.editaja.com server
 * @param file - The file to upload
 * @param userId - User ID
 * @param type - Type of image ("original" for user uploads, "generated" should use /api/image/save-generated)
 * @returns The public URL of the uploaded file from gambar.editaja.com
 */
export const uploadImageToLocal = async (
  file: File,
  userId: string,
  type: "original" | "generated"
): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    formData.append("type", type);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }));
      throw new Error(errorData.error || "Failed to upload image");
    }

    const data = await response.json();

    if (!data.ok || !data.url) {
      throw new Error(data.error || "Failed to upload image");
    }

    return data.url;
  } catch (error: any) {
    console.error("Error uploading image to local server:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Save generation data to Firestore
 * @param generationData - The generation data to save
 * @returns The document ID of the saved generation
 */
export const saveGenerationToFirestore = async (
  generationData: GenerationData
): Promise<string> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const generationsRef = collection(db, "generations");
    const docRef = await addDoc(generationsRef, {
      ...generationData,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    // Check if error is about document already existing
    // This can happen if addDoc somehow gets called with an existing ID
    // or if there's a race condition
    const errorMessage = String(error?.message || "");
    const errorCode = String(error?.code || "");
    
    // Check for "already exists" error in any form
    const isAlreadyExists = 
      errorMessage.toLowerCase().includes("already exists") || 
      errorCode === "already-exists" ||
      errorMessage.includes("Document already exists");
    
    if (isAlreadyExists) {
      // Silently handle duplicate save - don't log as error, just return placeholder
      // The images are already generated, so we don't want to fail the whole process
      return "save-skipped-duplicate";
    }
    
    // For ALL other errors, log as warning (not error) and continue
    // The images are already generated successfully, so we don't want to fail the whole process
    console.warn("Failed to save generation to Firestore (generation was successful):", errorCode, errorMessage);
    return "save-failed-but-ok";
  }
};
