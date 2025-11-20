"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { checkAdminStatus, handleGoogleRedirectResult } from "@/lib/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

if (typeof window !== "undefined" && !auth) {
  console.error("Firebase auth not initialized. Check your Firebase configuration.");
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  setUser: (user: User | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  setUser: () => {},
  setIsAdmin: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const checkUserIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Handle Google redirect result (if user came back from Google sign-in)
    const handleRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult();
        if (result) {
          console.log("User signed in via redirect");
        }
      } catch (error) {
        console.error("Error handling redirect result:", error);
      }
    };

    handleRedirect();

    const updateUserState = async (user: User | null) => {
      // Clean up previous interval
      if (checkUserIntervalRef.current) {
        clearInterval(checkUserIntervalRef.current);
        checkUserIntervalRef.current = null;
      }

      if (!isMounted) return;

      setUser(user);
      if (user) {
        try {
          // REMOVED: user.reload() that was causing infinite loop
          // This was triggering onIdTokenChanged -> reload -> token change -> reload
          // Token changes are already handled by onAuthStateChanged
          
          const adminStatus = await checkAdminStatus(user.uid);
          if (!isMounted) return;
          
          setIsAdmin(adminStatus);
          
          // Check if user document exists in Firestore using getDoc instead of onSnapshot
          // Use polling with longer interval (60 seconds) to reduce Firestore quota usage
          // Real-time listeners consume too much quota when they reconnect repeatedly
          if (db) {
            const firestoreDb = db; // Store in local variable for TypeScript
            const checkUserExists = async () => {
              if (!isMounted || !auth?.currentUser?.uid || auth.currentUser.uid !== user.uid) {
                // User changed or component unmounted, stop checking
                if (checkUserIntervalRef.current) {
                  clearInterval(checkUserIntervalRef.current);
                  checkUserIntervalRef.current = null;
                }
                return;
              }
              
              try {
                const userRef = doc(firestoreDb, "users", user.uid);
                const userSnap = await getDoc(userRef);
                
                if (!userSnap.exists() && auth?.currentUser?.uid === user.uid && isMounted) {
                  // User document doesn't exist yet - might be a new user
                  // Try to create it first before logging out
                  // This handles race condition where AuthContext checks before document is created
                  try {
                    await setDoc(userRef, {
                      email: auth.currentUser.email || null,
                      displayName: auth.currentUser.displayName || null,
                      photoURL: auth.currentUser.photoURL || null,
                      createdAt: serverTimestamp(),
                    });
                    console.log("User document created by AuthContext");
                    
                    // Also initialize tokens if not exists
                    try {
                      const { initializeUserTokens } = await import("@/lib/tokens");
                      await initializeUserTokens(user.uid);
                    } catch (tokenError) {
                      console.error("Error initializing tokens in AuthContext:", tokenError);
                    }
                  } catch (createError: any) {
                    // If creation fails (e.g., permission denied), check if it's a real error
                    // Only logout if it's a permission error that suggests user shouldn't exist
                    if (createError.code === "permission-denied") {
                      console.warn("Permission denied creating user document - user may not be allowed");
                      // Don't logout immediately - might be a temporary permission issue
                      // The document might be created by signInWithGoogle function
                    } else {
                      console.error("Error creating user document in AuthContext:", createError);
                      // Don't logout - allow user to continue, document might be created elsewhere
                    }
                  }
                }
              } catch (error) {
                // Silently handle errors to prevent log spam
                // Firestore quota might be exceeded, don't spam console
                if (error instanceof Error && !error.message.includes("quota")) {
                  console.error("Error checking user document:", error);
                }
              }
            };
            
            // Wait 3 seconds before first check to allow user document creation to complete
            // This is important for new users who just signed up
            setTimeout(() => {
              if (isMounted && auth?.currentUser?.uid === user.uid) {
                checkUserExists();
              }
            }, 3000);
            
            // Then check every 60 seconds instead of real-time listener
            // This reduces Firestore quota usage by ~98% (from continuous connection to 1 request per minute)
            // Only check if user is still logged in and component is mounted
            checkUserIntervalRef.current = setInterval(() => {
              if (isMounted && auth?.currentUser?.uid === user.uid) {
                checkUserExists();
              } else {
                // Clean up if user changed or component unmounted
                if (checkUserIntervalRef.current) {
                  clearInterval(checkUserIntervalRef.current);
                  checkUserIntervalRef.current = null;
                }
              }
            }, 60000); // 60 seconds - reduces quota usage significantly
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          if (isMounted) {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, updateUserState);
    
    // REMOVED: onIdTokenChanged listener that was causing loop
    // This was calling user.reload() which triggered token change events
    // which then triggered reload again, creating infinite loop
    // Token changes are already handled by onAuthStateChanged

    return () => {
      isMounted = false;
      unsubscribe();
      // Clean up interval
      if (checkUserIntervalRef.current) {
        clearInterval(checkUserIntervalRef.current);
        checkUserIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        setUser,
        setIsAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

