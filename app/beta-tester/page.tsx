"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getCountFromServer } from "firebase/firestore";
import { getBetaTesterRegistrationEnabled, getBetaTesterFreeTokens, getMaxBetaTesters } from "@/lib/settings";
import { signInWithGoogle } from "@/lib/auth";

export default function BetaTesterPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [freeTokens, setFreeTokens] = useState(1000);
  const [isRegistered, setIsRegistered] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Check registration status and settings
  useEffect(() => {
    const checkStatus = async () => {
      try {
        setCheckingStatus(true);
        
        // Check if registration is enabled
        const enabled = await getBetaTesterRegistrationEnabled();
        setRegistrationEnabled(enabled);

        if (!enabled) {
          setCheckingStatus(false);
          return;
        }

        // Get free tokens amount
        const tokens = await getBetaTesterFreeTokens();
        setFreeTokens(tokens);

        // Check if user is already registered
        if (user && db) {
          const currentUser = auth?.currentUser;
          if (currentUser) {
            const userId = currentUser.uid;
            const betaTesterRef = doc(db, "betaTesters", userId);
            const betaTesterDoc = await getDoc(betaTesterRef);
            setIsRegistered(betaTesterDoc.exists());
          }
        }
      } catch (error: any) {
        console.error("Error checking status:", error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkStatus();
  }, [user]);

  const handleRegister = async () => {
    if (!user) {
      setError("Please login first to register as a beta tester");
      return;
    }

    if (!db) {
      setError("Database not initialized");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const userId = currentUser.uid;
      const userEmail = currentUser.email;

      if (!userId || !userEmail) {
        throw new Error("Invalid user data");
      }

      // Check if user is already a beta tester
      const betaTesterRef = doc(db, "betaTesters", userId);
      const betaTesterDoc = await getDoc(betaTesterRef);

      if (betaTesterDoc.exists()) {
        setError("You are already registered as a beta tester");
        setIsRegistered(true);
        setLoading(false);
        return;
      }

      // Check max beta testers limit
      const maxBetaTesters = await getMaxBetaTesters();
      if (maxBetaTesters !== null && maxBetaTesters > 0) {
        // Count current beta testers
        const betaTestersCollection = collection(db, "betaTesters");
        const countSnapshot = await getCountFromServer(betaTestersCollection);
        const currentCount = countSnapshot.data().count;

        if (currentCount >= maxBetaTesters) {
          setError(`Beta tester registration is full. Maximum ${maxBetaTesters} beta tester${maxBetaTesters !== 1 ? 's' : ''} allowed.`);
          setLoading(false);
          return;
        }
      }

      // Get free tokens amount
      const tokens = await getBetaTesterFreeTokens();

      // Register user as beta tester
      await setDoc(betaTesterRef, {
        userId: userId,
        email: userEmail,
        registeredAt: serverTimestamp(),
        freeTokensReceived: tokens,
      });

      // Add free tokens to user account
      const userTokensRef = doc(db, "userTokens", userId);
      const userTokensDoc = await getDoc(userTokensRef);

      if (userTokensDoc.exists()) {
        const currentTokens = userTokensDoc.data()?.tokens || 0;
        await updateDoc(userTokensRef, {
          tokens: currentTokens + tokens,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userTokensRef, {
          userId: userId,
          tokens: tokens,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSuccess(`Successfully registered as beta tester! ${tokens} tokens have been added to your account.`);
      setIsRegistered(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (error: any) {
      console.error("Error registering:", error);
      setError(error.message || "Failed to register as beta tester");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101022]">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101022] p-4">
        <div className="w-full max-w-md rounded-xl bg-[#242424] p-8 shadow-2xl border border-white/10">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-white/30 mb-4 block">
              block
            </span>
            <h1 className="text-2xl font-bold text-white mb-2">Registration Closed</h1>
            <p className="text-white/70">
              Beta tester registration is currently disabled. Please check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101022] p-4">
      <div className="w-full max-w-md rounded-xl bg-[#242424] p-8 shadow-2xl border border-white/10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-4xl">science</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">Beta Tester Program</h1>
          </div>
          <p className="text-white/70">
            Join our beta testing program and get free tokens!
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-500/50 p-3 text-sm text-green-400">
            {success}
          </div>
        )}

        {isRegistered ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-primary mb-4 block">
              check_circle
            </span>
            <h2 className="text-xl font-bold text-white mb-2">Already Registered!</h2>
            <p className="text-white/70 mb-4">
              You are already registered as a beta tester.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to Home
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6 rounded-lg bg-primary/10 border border-primary/30 p-4">
              <h3 className="text-lg font-semibold text-white mb-2">What You'll Get:</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span><strong className="text-primary">{freeTokens.toLocaleString()}</strong> free tokens/diamonds</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span>Early access to new features</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  <span>Help shape the future of our platform</span>
                </li>
              </ul>
            </div>

            {!user ? (
              <div className="space-y-3">
                <p className="text-white/70 text-sm text-center">
                  Please login first to register as a beta tester
                </p>
                <button
                  onClick={async () => {
                    try {
                      setSigningIn(true);
                      setError("");
                      await signInWithGoogle(false);
                      // User will be automatically updated via AuthContext
                      // No need to redirect, the component will re-render
                    } catch (error: any) {
                      console.error("Error signing in:", error);
                      setError(error.message || "Failed to sign in with Google. Please try again.");
                    } finally {
                      setSigningIn(false);
                    }
                  }}
                  disabled={signingIn}
                  className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {signingIn ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>Login with Google</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">person_add</span>
                    <span>Register as Beta Tester</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

