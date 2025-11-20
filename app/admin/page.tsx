"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInAdmin } from "@/lib/auth";
import { useAuth } from "@/app/contexts/AuthContext";
import { useGeneralSettings } from "@/app/components/GeneralSettingsProvider";

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { settings: generalSettings } = useGeneralSettings();

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      router.push("/admin/dashboard");
    }
  }, [user, isAdmin, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101022]">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && isAdmin) {
    return null;
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInAdmin(email, password);
      // Wait a bit for auth state to update
      setTimeout(() => {
        router.push("/admin/dashboard");
      }, 500);
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage = error.message || "Invalid admin credentials";
      
      // Show user-friendly error message
      if (errorMessage.includes("Invalid email or password")) {
        setError(errorMessage);
      } else if (errorMessage.includes("Access denied")) {
        setError(
          `${errorMessage}\n\n` +
          `💡 This account exists but doesn't have admin privileges.\n` +
          `Please contact the system administrator to grant admin access.`
        );
      } else {
        setError(
          `${errorMessage}\n\n` +
          `💡 Troubleshooting Tips:\n` +
          `1. Verify the email and password are correct\n` +
          `2. Check if the user exists in Firebase Authentication\n` +
          `3. Ensure admin document exists in Firestore 'admins' collection with Document ID = user UID\n` +
          `4. Verify the 'isAdmin' field is set to true (boolean, not string)\n` +
          `5. Click "Debug Admin Status" link below for detailed information`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 bg-[#101022]">
      <div className="w-full max-w-md rounded-xl bg-[#242424] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary text-4xl">edit_square</span>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {generalSettings?.websiteName || "edit Aja"}
            </h1>
          </div>
          <p className="mt-2 text-lg text-[#888888]">Admin Login</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400 whitespace-pre-line">
            {error}
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-[#EAEAEA]" htmlFor="email">
              Email
            </label>
            <input
              className="form-input h-12 w-full resize-none rounded-lg border-none bg-[#1A1A1A] p-3 text-base text-white placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-primary"
              id="email"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-[#EAEAEA]" htmlFor="password">
              Password
            </label>
            <div className="relative flex w-full items-stretch">
              <input
                className="form-input h-12 w-full flex-1 resize-none rounded-lg rounded-r-none border-none bg-[#1A1A1A] p-3 pr-10 text-base text-white placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-primary"
                id="password"
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                aria-label="Toggle password visibility"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#888888] hover:text-white"
                type="button"
                onClick={togglePasswordVisibility}
              >
                <span className="material-symbols-outlined">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                className="form-checkbox h-4 w-4 rounded border-[#3b3b54] border-2 bg-transparent text-primary checked:border-primary checked:bg-primary focus:ring-0 focus:ring-offset-0"
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label className="text-sm text-[#EAEAEA]" htmlFor="remember-me">
                Remember Me
              </label>
            </div>
            <a className="text-sm font-medium text-primary hover:underline" href="#">
              Forgot Password?
            </a>
          </div>
          <button
            className="flex h-12 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-base font-bold text-white transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#242424] disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          {user && (
            <div>
              <a
                className="text-sm text-primary hover:underline transition-colors"
                href="/admin/debug"
              >
                Debug Admin Status (Check why login failed)
              </a>
            </div>
          )}
        </div>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-[#888888]">
        <p>
          © {new Date().getFullYear()} {generalSettings?.websiteName || "edit Aja"}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

