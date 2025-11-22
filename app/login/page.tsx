"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page immediately
    router.replace("/");
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101022]">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="text-white">Redirecting...</p>
      </div>
    </div>
  );
}

