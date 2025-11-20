"use client";

import { useState, useEffect } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { useAuth } from "@/app/contexts/AuthContext";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  // Close modal if user is logged in
  useEffect(() => {
    if (user && isOpen) {
      onClose();
    }
  }, [user, isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError("");
      // Try popup first (better UX)
      const result = await signInWithGoogle(false);
      // If popup succeeded (result is UserCredential), close modal
      // The user state will be updated by AuthContext
      if (result) {
        onClose();
      }
      // Note: If redirect is used (result is void), page will redirect
      // so onClose() won't be called
    } catch (error: any) {
      setLoading(false);
      const errorMessage = error.message || "Failed to sign in with Google";
      
      // If popup failed, offer redirect as alternative
      if (errorMessage.includes("Popup blocked") || errorMessage.includes("popup")) {
        setError(
          "Popup blocked. Click 'Use Redirect' to sign in with Google (you'll be redirected to Google and back)."
        );
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleGoogleSignInRedirect = async () => {
    try {
      setLoading(true);
      setError("");
      // Use redirect method (works when popup is blocked)
      await signInWithGoogle(true);
      // Note: onClose() won't be called here because the page will redirect
      // The user will be redirected back to the app after Google sign-in
    } catch (error: any) {
      setLoading(false);
      setError(error.message || "Failed to sign in with Google");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-xl bg-[#242424] p-8 shadow-2xl border border-white/10 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary text-4xl">edit_square</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">edit Aja</h1>
          </div>
          <p className="mt-2 text-lg text-[#888888]">Welcome back</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? "Loading..." : "Continue with Google"}
        </button>

        {error && error.includes("Use Redirect") && (
          <button
            className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2 text-base font-medium text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            onClick={handleGoogleSignInRedirect}
            disabled={loading}
          >
            Use Redirect Instead
          </button>
        )}

        <div className="mt-6 text-center">
          <button
            className="text-sm text-[#888888] hover:text-white transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

