import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updatePassword,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
  UserCredential,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeUserTokens } from "./tokens";

const googleProvider = new GoogleAuthProvider();

// Set custom parameters for Google sign-in
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export interface AdminUser {
  uid: string;
  email: string;
  isAdmin: boolean;
  createdAt?: any;
}

// Check if user is admin
export const checkAdminStatus = async (uid: string): Promise<boolean> => {
  try {
    if (!db) {
      console.error("Firestore not initialized");
      return false;
    }

    const adminDocRef = doc(db, "admins", uid);
    const adminDoc = await getDoc(adminDocRef);

    if (!adminDoc.exists()) {
      console.warn(`Admin document not found for UID: ${uid}`);
      console.warn("Please create a document in 'admins' collection with document ID = user UID");
      return false;
    }

    const adminData = adminDoc.data();
    const isAdmin = adminData?.isAdmin === true;

    // Debug logging
    console.log("Admin check:", {
      uid,
      documentExists: adminDoc.exists(),
      documentId: adminDoc.id,
      isAdminField: adminData?.isAdmin,
      isAdminFieldType: typeof adminData?.isAdmin,
      isAdminResult: isAdmin,
    });

    if (adminData?.isAdmin !== true) {
      console.warn("isAdmin field is not true. Current value:", adminData?.isAdmin);
      console.warn("Field type:", typeof adminData?.isAdmin);
      if (typeof adminData?.isAdmin === "string") {
        console.warn("⚠️ isAdmin is a string! It should be a boolean.");
      }
    }

    return isAdmin;
  } catch (error: any) {
    console.error("Error checking admin status:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    // Check if it's a permissions error
    if (error.code === "permission-denied") {
      console.error("⚠️ Firestore permission denied. Check your Firestore security rules.");
    }
    
    return false;
  }
};

// User Authentication
// Try popup first (preferred for better UX), fallback to redirect if popup fails
export const signInWithGoogle = async (useRedirect: boolean = false): Promise<UserCredential | void> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  
  if (useRedirect) {
    // Use redirect method (works with COOP policy, but redirects page)
    await signInWithRedirect(auth, googleProvider);
    // Note: The actual UserCredential will be returned via getRedirectResult
    // after the redirect callback
    return;
  } else {
    // Try popup method first (better UX, works with COOP: same-origin-allow-popups)
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // If user signed in via popup, create user document if it doesn't exist
      if (result.user && db) {
        try {
          const userDocRef = doc(db, "users", result.user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create user document for new user
            console.log("Creating new user document for:", result.user.uid, result.user.email);
            try {
              await setDoc(userDocRef, {
                email: result.user.email,
                displayName: result.user.displayName || null,
                photoURL: result.user.photoURL || null,
                createdAt: serverTimestamp(),
              });
              console.log("User document created successfully");
            } catch (createError: any) {
              console.error("Error creating user document:", createError);
              console.error("Error code:", createError.code);
              console.error("Error message:", createError.message);
              // Don't throw - allow user to continue even if document creation fails
              // The document might be created later or there might be a permission issue
            }
          } else {
            console.log("User document already exists");
          }
          
          // Always ensure user tokens are initialized (for both new and existing users)
          // This handles cases where token document might be missing
          try {
            await initializeUserTokens(result.user.uid);
            console.log("User tokens initialized successfully");
          } catch (tokenError: any) {
            console.error("Error initializing user tokens:", tokenError);
            console.error("Token error code:", tokenError.code);
            console.error("Token error message:", tokenError.message);
            // Continue even if token initialization fails (document might already exist)
          }
        } catch (error: any) {
          console.error("Error in user document creation process:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          // Don't throw - allow user to continue even if there's an error
          // The error might be due to Firestore rules or network issues
        }
      }
      
      return result;
    } catch (error: any) {
      // If popup fails, check if it's due to COOP or popup being blocked
      const isPopupError = 
        error.code === "auth/popup-blocked" || 
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request" ||
        error.message?.includes("Cross-Origin-Opener-Policy") || 
        error.message?.includes("window.closed") ||
        error.message?.includes("popup");
      
      if (isPopupError) {
        // If popup fails due to COOP or being blocked, throw a specific error
        // The UI can then offer redirect as an alternative
        throw new Error(
          "Popup blocked or failed. Please allow popups for this site or try using redirect method."
        );
      }
      throw error;
    }
  }
};

// Handle redirect result after Google sign-in
export const handleGoogleRedirectResult = async (): Promise<UserCredential | null> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      // User signed in via redirect
      // Check if user document exists, create if not
      if (db) {
        try {
          const userDocRef = doc(db, "users", result.user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create user document
            console.log("Creating new user document (redirect) for:", result.user.uid, result.user.email);
            try {
              await setDoc(userDocRef, {
                email: result.user.email,
                displayName: result.user.displayName || null,
                photoURL: result.user.photoURL || null,
                createdAt: serverTimestamp(),
              });
              console.log("User document created successfully (redirect)");
            } catch (createError: any) {
              console.error("Error creating user document (redirect):", createError);
              console.error("Error code:", createError.code);
              console.error("Error message:", createError.message);
              // Don't throw - allow user to continue even if document creation fails
            }
          } else {
            console.log("User document already exists (redirect)");
          }
          
          // Always ensure user tokens are initialized (even for existing users)
          // This handles cases where token document might be missing
          try {
            await initializeUserTokens(result.user.uid);
            console.log("User tokens initialized successfully (redirect)");
          } catch (tokenError: any) {
            console.error("Error initializing user tokens (redirect):", tokenError);
            console.error("Token error code:", tokenError.code);
            console.error("Token error message:", tokenError.message);
            // Continue even if token initialization fails (document might already exist)
          }
        } catch (error: any) {
          console.error("Error in user document creation process (redirect):", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          // Don't throw - allow user to continue even if there's an error
        }
      }
    }
    return result;
  } catch (error: any) {
    console.error("Error handling redirect result:", error);
    throw error;
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Ensure user document exists and tokens are initialized
  if (userCredential.user && db) {
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // Create user document if it doesn't exist
      await setDoc(userDocRef, {
        email: userCredential.user.email,
        createdAt: serverTimestamp(),
      });
    }
    
    // Always ensure user tokens are initialized (even for existing users)
    // This handles cases where token document might be missing
    try {
      await initializeUserTokens(userCredential.user.uid);
    } catch (error) {
      console.error("Error initializing user tokens:", error);
      // Continue even if token initialization fails (document might already exist)
    }
  }
  
  return userCredential;
};

export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  // Create user document in Firestore
  await setDoc(doc(db, "users", userCredential.user.uid), {
    email: userCredential.user.email,
    createdAt: serverTimestamp(),
  });
  
  // Initialize user tokens (100 tokens for new user)
  try {
    await initializeUserTokens(userCredential.user.uid);
  } catch (error) {
    console.error("Error initializing user tokens:", error);
    // Continue even if token initialization fails
  }
  
  return userCredential;
};

// Admin Authentication
export const signInAdmin = async (
  email: string,
  password: string
): Promise<{ user: User; isAdmin: boolean }> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await checkAdminStatus(userCredential.user.uid);

    if (!isAdmin) {
      await signOut(auth);
      throw new Error("Access denied. Admin privileges required.");
    }

    return { user: userCredential.user, isAdmin };
  } catch (error: any) {
    // Handle Firebase auth errors
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      throw new Error("Invalid email or password. Please check your credentials and try again.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email format. Please enter a valid email address.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed login attempts. Please try again later.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.");
    }
    // Re-throw other errors as-is
    throw error;
  }
};

// Update admin password
export const updateAdminPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  if (!auth?.currentUser) {
    throw new Error("No user is currently signed in");
  }

  try {
    const user = auth.currentUser;
    
    // Re-authenticate user with current password
    if (user.email) {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    } else {
      throw new Error("User email not found");
    }

    // Update password
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error("Error updating password:", error);
    if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
      throw new Error("Current password is incorrect");
    } else if (error.code === "auth/weak-password") {
      throw new Error("New password is too weak. Please use a stronger password.");
    }
    throw error;
  }
};

// Update admin display name
export const updateAdminDisplayName = async (displayName: string): Promise<void> => {
  if (!auth?.currentUser) {
    throw new Error("No user is currently signed in");
  }

  try {
    await updateProfile(auth.currentUser, {
      displayName: displayName,
    });
    // Reload user to get updated profile data
    await auth.currentUser.reload();
  } catch (error: any) {
    console.error("Error updating display name:", error);
    throw error;
  }
};

// Create admin user (should be called manually or through a separate admin creation function)
export const createAdminUser = async (
  uid: string,
  email: string
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  await setDoc(doc(db, "admins", uid), {
    email,
    isAdmin: true,
    createdAt: serverTimestamp(),
  });
};

export const logout = async (): Promise<void> => {
  if (!auth) {
    throw new Error("Firebase auth not initialized");
  }
  return signOut(auth);
};

