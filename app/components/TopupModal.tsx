"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { getTopupPlans, TopupPlan } from "@/lib/settings";

interface TopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiamonds: number;
  onTopupSuccess?: () => void;
}

interface TopupPackage {
  id: string;
  diamonds: number;
  price: number;
  anchorPrice?: number; // Base price before discount
  bonus?: number;
  popular?: boolean;
}

declare global {
  interface Window {
    snap: any;
  }
}

export default function TopupModal({
  isOpen,
  onClose,
  currentDiamonds,
  onTopupSuccess,
}: TopupModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<TopupPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [midtransClientKey, setMidtransClientKey] = useState<string | null>(null);
  const [midtransLoaded, setMidtransLoaded] = useState(false);
  const [topupPackages, setTopupPackages] = useState<TopupPackage[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const { user } = useAuth();

  // Load topup plans from Firestore
  useEffect(() => {
    if (!isOpen) return;

    const loadPlans = async () => {
      try {
        setLoadingPlans(true);
        const plans = await getTopupPlans();
        // Convert TopupPlan to TopupPackage format
        const packages: TopupPackage[] = plans.map((plan) => ({
          id: plan.id,
          diamonds: plan.diamonds,
          price: plan.price,
          anchorPrice: plan.anchorPrice,
          bonus: plan.bonus,
          popular: plan.popular,
        }));
        setTopupPackages(packages);
      } catch (error: any) {
        console.error("Error loading topup plans:", error);
        // Fallback to default plans if error
        setTopupPackages([
          { id: "1", diamonds: 100, price: 10000, anchorPrice: 15000, bonus: 0 },
          { id: "2", diamonds: 250, price: 22500, anchorPrice: 37500, bonus: 25, popular: true },
          { id: "3", diamonds: 500, price: 40000, anchorPrice: 75000, bonus: 100 },
        ]);
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, [isOpen]);

  // Load Midtrans client key and script
  useEffect(() => {
    if (!isOpen) return;

    const loadMidtrans = async () => {
      try {
        // Get client key from API
        const response = await fetch("/api/midtrans/config");
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.clientKey) {
            setMidtransClientKey(data.clientKey);
            
            // Load Midtrans Snap.js script
            if (!document.getElementById("midtrans-script")) {
              const script = document.createElement("script");
              script.id = "midtrans-script";
              script.src = data.isProduction
                ? "https://app.midtrans.com/snap/snap.js"
                : "https://app.sandbox.midtrans.com/snap/snap.js";
              script.setAttribute("data-client-key", data.clientKey);
              script.onload = () => {
                setMidtransLoaded(true);
              };
              script.onerror = () => {
                console.error("Failed to load Midtrans Snap.js");
                setError("Failed to load payment gateway. Please refresh the page.");
              };
              document.body.appendChild(script);
            } else {
              setMidtransLoaded(true);
            }
          }
        }
      } catch (error: any) {
        console.error("Error loading Midtrans config:", error);
      }
    };

    loadMidtrans();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Check payment status
  const checkPaymentStatus = async (orderId: string): Promise<any> => {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) return null;

      const idToken = await currentUser.getIdToken();
      
      const response = await fetch(`/api/midtrans/status?orderId=${encodeURIComponent(orderId)}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking payment status:", error);
      return null;
    }
  };

  // Complete transaction manually (for cases where webhook doesn't work)
  const completeTransactionManually = async (orderId: string): Promise<boolean> => {
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) return false;

      const idToken = await currentUser.getIdToken();
      
      const response = await fetch("/api/midtrans/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      console.error("Error completing transaction:", error);
      return false;
    }
  };

  const handleTopup = async (pkg: TopupPackage) => {
    if (!user) {
      setError("Please login first");
      return;
    }

    if (!midtransLoaded || !window.snap) {
      setError("Payment gateway is not ready. Please wait a moment and try again.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSelectedPackage(pkg);

      // Get Firebase auth token
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const idToken = await currentUser.getIdToken();

      // Create payment via API
      const response = await fetch("/api/midtrans/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          packageId: pkg.id,
          diamonds: pkg.diamonds,
          bonus: pkg.bonus || 0,
          price: pkg.price,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      // Store orderId for polling
      const orderId = data.orderId;

      // Open Midtrans Snap payment popup
      window.snap.pay(data.token, {
        onSuccess: async (result: any) => {
          console.log("Payment success:", result);
          
          // Start polling to check payment status
          let attempts = 0;
          const maxAttempts = 15; // Check for 30 seconds (15 * 2s)
          let isCompleted = false;

          const pollInterval = setInterval(async () => {
            attempts++;
            const statusData = await checkPaymentStatus(orderId);

            if (statusData?.ok) {
              console.log(`Payment status check ${attempts}:`, statusData.status);

              // If status is settlement, complete the transaction
              if (statusData.status === "settlement" && !isCompleted) {
                isCompleted = true;
                clearInterval(pollInterval);

                // Try to complete transaction manually (in case webhook didn't work)
                const completed = await completeTransactionManually(orderId);
                
                if (onTopupSuccess) {
                  onTopupSuccess();
                }
                
                alert(
                  `Payment successful! ${pkg.diamonds}${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""} diamonds have been added to your account.`
                );
                onClose();
              } else if (statusData.status === "pending" && attempts >= maxAttempts) {
                // Still pending after max attempts
                clearInterval(pollInterval);
                alert(
                  "Payment is being processed. Your diamonds will be added automatically once payment is confirmed. Please check your account in a few minutes."
                );
                onClose();
              }
            } else if (attempts >= maxAttempts) {
              // Max attempts reached
              clearInterval(pollInterval);
              alert(
                "Payment received but status check timed out. Your diamonds will be added automatically once payment is confirmed. Please check your account in a few minutes."
              );
              onClose();
            }
          }, 2000); // Check every 2 seconds

          // Also close modal immediately (polling continues in background)
          onClose();
        },
        onPending: (result: any) => {
          console.log("Payment pending:", result);
          
          // Start polling for pending payments too
          let attempts = 0;
          const maxAttempts = 30; // Check for 60 seconds for pending payments
          
          const pollInterval = setInterval(async () => {
            attempts++;
            const statusData = await checkPaymentStatus(orderId);

            if (statusData?.ok && statusData.status === "settlement") {
              clearInterval(pollInterval);
              
              // Complete transaction
              await completeTransactionManually(orderId);
              
              if (onTopupSuccess) {
                onTopupSuccess();
              }
              
              alert(
                `Payment confirmed! ${pkg.diamonds}${pkg.bonus ? ` + ${pkg.bonus} bonus` : ""} diamonds have been added to your account.`
              );
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              alert(
                "Your payment is pending. Please complete the payment to receive your diamonds. Once completed, diamonds will be added automatically."
              );
            }
          }, 2000);
          
          alert("Your payment is pending. Please complete the payment to receive your diamonds.");
          onClose();
        },
        onError: (result: any) => {
          console.error("Payment error:", result);
          setError("Payment failed. Please try again.");
          setLoading(false);
          setSelectedPackage(null);
        },
        onClose: () => {
          console.log("Payment popup closed");
          setLoading(false);
          setSelectedPackage(null);
        },
      });
    } catch (error: any) {
      console.error("Error processing topup:", error);
      setError(error.message || "Failed to process payment");
      setLoading(false);
      setSelectedPackage(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-4xl rounded-xl bg-[#242424] p-6 sm:p-8 shadow-2xl border border-white/10 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Top Up Diamonds</h2>
          </div>
          {/* User Email */}
          {user?.email && (
            <div className="mb-3">
              <p className="text-xs text-white/50 mb-1">Email</p>
              <p className="text-sm text-white/80 font-medium">{user.email}</p>
            </div>
          )}
          <p className="text-[#888888] text-sm">
            Current balance:{" "}
            <span className="text-primary font-semibold inline-flex items-center gap-1">
              {currentDiamonds.toLocaleString()}{" "}
              <svg
                className="w-4 h-4 text-primary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loadingPlans ? (
          <div className="flex items-center justify-center py-12 mb-6">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="text-white/70">Loading packages...</p>
            </div>
          </div>
        ) : topupPackages.length === 0 ? (
          <div className="text-center py-12 mb-6">
            <p className="text-white/70">No packages available. Please contact administrator.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {topupPackages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleTopup(pkg)}
                disabled={loading}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  pkg.popular
                    ? "border-primary bg-primary/10 hover:bg-primary/20"
                    : "border-white/10 bg-[#1A1A1A] hover:border-primary/50 hover:bg-white/5"
                } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                    POPULAR
                  </span>
                </div>
              )}

              <div className="flex flex-col items-center mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-white font-bold text-lg">
                    {pkg.diamonds}
                    {pkg.bonus ? ` + ${pkg.bonus}` : ""}
                  </span>
                </div>
                {pkg.bonus && (
                  <span className="text-xs text-primary font-semibold">Bonus!</span>
                )}
              </div>

              <div className="text-center">
                {pkg.anchorPrice && pkg.anchorPrice > pkg.price && (
                  <p className="text-[#888888] text-xs line-through mb-1">
                    {formatPrice(pkg.anchorPrice)}
                  </p>
                )}
                <p className="text-primary font-bold text-lg">
                  {formatPrice(pkg.price)}
                </p>
                <p className="text-[#888888] text-xs mt-1">
                  {Math.round((pkg.price / (pkg.diamonds + (pkg.bonus || 0))) * 100) / 100} per
                  diamond
                </p>
              </div>

              {loading && selectedPackage?.id === pkg.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </button>
          ))}
          </div>
        )}

        <div className="border-t border-white/10 pt-4">
          <p className="text-[#888888] text-xs text-center">
            {midtransLoaded
              ? "Secure payment powered by Midtrans"
              : "Loading payment gateway..."}
          </p>
        </div>
      </div>
    </div>
  );
}

