"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { getTopupTransactionByOrderId } from "@/lib/topups";
import { getUserTokens } from "@/lib/tokens";

declare global {
  interface Window {
    snap: any;
  }
}

export default function TestMidtransPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [diamonds, setDiamonds] = useState<number>(0);
  const [currentOrderId, setCurrentOrderId] = useState<string>("");
  const [midtransClientKey, setMidtransClientKey] = useState<string | null>(null);
  const [midtransLoaded, setMidtransLoaded] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  
  // Test packages
  const testPackages = [
    { id: "test-1", name: "Test Package 1", diamonds: 100, bonus: 10, price: 10000 },
    { id: "test-2", name: "Test Package 2", diamonds: 500, bonus: 50, price: 50000 },
    { id: "test-3", name: "Test Package 3", diamonds: 1000, bonus: 100, price: 100000 },
  ];


  // Load Midtrans config and script
  useEffect(() => {
    const loadMidtrans = async () => {
      try {
        const response = await fetch("/api/midtrans/config");
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.clientKey) {
            setMidtransClientKey(data.clientKey);
            setIsProduction(data.isProduction || false);
            
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
                addResult("✅ Midtrans Snap script loaded", "success");
              };
              script.onerror = () => {
                console.error("Failed to load Midtrans Snap.js");
                addResult("❌ Failed to load Midtrans Snap.js", "error");
              };
              document.body.appendChild(script);
            } else {
              setMidtransLoaded(true);
            }
          }
        }
      } catch (error: any) {
        console.error("Error loading Midtrans config:", error);
        addResult(`❌ Error loading Midtrans config: ${error.message}`, "error");
      }
    };

    loadMidtrans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get user tokens
  useEffect(() => {
    const fetchTokens = async () => {
      if (user) {
        try {
          const tokens = await getUserTokens(user.uid);
          setDiamonds(tokens);
        } catch (error) {
          console.error("Error fetching tokens:", error);
        }
      }
    };
    fetchTokens();
  }, [user]);

  // Use ref for counter to ensure unique IDs (avoid duplicate keys)
  const resultIdCounterRef = React.useRef(0);

  const addResult = (message: string, type: "success" | "error" | "info" = "info") => {
    setResults((prev) => {
      resultIdCounterRef.current += 1;
      // Combine timestamp, counter, and random string to ensure uniqueness
      const uniqueId = `${Date.now()}-${resultIdCounterRef.current}-${Math.random().toString(36).substr(2, 9)}`;
      return [
        ...prev,
        {
          id: uniqueId,
          message,
          type,
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
    });
  };

  const testCreatePayment = async (pkg: typeof testPackages[0]) => {
    if (!user) {
      addResult("❌ Please login first", "error");
      return;
    }

    try {
      setLoading(true);
      addResult(`🔄 Creating payment for ${pkg.name}...`, "info");

      // Get auth token
      const idToken = await user.getIdToken();

      // Create payment
      const response = await fetch("/api/midtrans/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          packageId: pkg.id,
          diamonds: pkg.diamonds,
          bonus: pkg.bonus,
          price: pkg.price,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        const errorMessage = data.error || "Failed to create payment";
        
        // Enhanced error message for Firebase Admin SDK error
        if (errorMessage.includes("Firebase Admin SDK not initialized")) {
          addResult(`❌ ${errorMessage}`, "error");
          addResult(`🔧 SETUP REQUIRED:`, "error");
          addResult(`1. Download service account key from Firebase Console`, "error");
          addResult(`2. Convert JSON to single-line string`, "error");
          addResult(`3. Add FIREBASE_SERVICE_ACCOUNT in Vercel Environment Variables`, "error");
          addResult(`4. Redeploy application`, "error");
          addResult(`📖 See: VERCEL-FIREBASE-ADMIN-SETUP.md for detailed instructions`, "error");
          throw new Error(errorMessage);
        }
        
        addResult(`❌ Error: ${errorMessage}`, "error");
        throw new Error(errorMessage);
      }

      addResult(`✅ Payment created successfully!`, "success");
      addResult(`Order ID: ${data.orderId}`, "info");
      addResult(`Transaction ID: ${data.transactionId}`, "info");
      
      setCurrentOrderId(data.orderId);

      // Wait for Midtrans Snap to be loaded
      if (!midtransLoaded || !window.snap) {
        addResult(`⏳ Waiting for Midtrans Snap to load...`, "info");
        
        // Wait up to 5 seconds for script to load
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.snap || attempts >= 10) {
            clearInterval(checkInterval);
            if (window.snap) {
              openMidtransPayment(data.token, data.orderId);
            } else {
              addResult(`❌ Midtrans Snap failed to load. Please refresh the page.`, "error");
            }
          }
        }, 500);
      } else {
        openMidtransPayment(data.token, data.orderId);
      }
    } catch (error: any) {
      console.error("Error creating payment:", error);
      addResult(`❌ Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const openMidtransPayment = (token: string, orderId: string) => {
    if (!window.snap) {
      addResult(`❌ Midtrans Snap is not available`, "error");
      return;
    }

    window.snap.pay(token, {
      onSuccess: (result: any) => {
        addResult(`✅ Payment successful!`, "success");
        addResult(`Midtrans Transaction ID: ${result.transaction_id}`, "info");
        addResult(`💡 Callback should be triggered automatically...`, "info");
        // Check transaction status after 3 seconds
        setTimeout(() => {
          checkTransactionStatus(orderId);
        }, 3000);
      },
      onPending: (result: any) => {
        addResult(`⏳ Payment pending...`, "info");
        addResult(`Transaction ID: ${result.transaction_id}`, "info");
        addResult(`💡 Waiting for payment confirmation. Callback will be triggered when payment is completed.`, "info");
      },
      onError: (result: any) => {
        addResult(`❌ Payment error: ${result.status_message || "Unknown error"}`, "error");
      },
      onClose: () => {
        addResult(`⚠️ Payment window closed by user`, "info");
        addResult(`💡 You can check transaction status manually using the button above`, "info");
      },
    });
  };

  const checkTransactionStatus = async (orderId?: string) => {
    const orderIdToCheck = orderId || currentOrderId;
    if (!orderIdToCheck) {
      addResult("❌ No order ID to check", "error");
      return;
    }

    if (!user) {
      addResult("❌ Please login first to check transaction status", "error");
      return;
    }

    try {
      setTesting(true);
      addResult(`🔄 Checking transaction status for: ${orderIdToCheck}...`, "info");

      // Pass userId to ensure we can read the transaction
      const transaction = await getTopupTransactionByOrderId(orderIdToCheck, user.uid);
      
      if (!transaction) {
        addResult(`❌ Transaction not found in Firestore`, "error");
        addResult(`⚠️ This means transaction was not saved when payment was created`, "error");
        addResult(`⚠️ Check if Firebase Admin SDK is configured properly`, "error");
        return;
      }

      addResult(`✅ Transaction found!`, "success");
      addResult(`Transaction ID: ${transaction.id}`, "info");
      addResult(`Status: ${transaction.status}`, transaction.status === "settlement" ? "success" : "info");
      addResult(`Diamonds: ${transaction.diamonds} + ${transaction.bonus || 0} bonus = ${transaction.diamonds + (transaction.bonus || 0)} total`, "info");
      addResult(`Price: Rp ${transaction.price.toLocaleString("id-ID")}`, "info");
      
      if (transaction.status === "settlement") {
        addResult(`✅ Transaction completed! Diamonds should be added to your account`, "success");
        // Refresh tokens
        if (user) {
          const tokens = await getUserTokens(user.uid);
          setDiamonds(tokens);
          addResult(`Current diamonds: ${tokens}`, "info");
        }
      } else if (transaction.status === "pending") {
        addResult(`⏳ Transaction still pending. Waiting for payment...`, "info");
        addResult(`💡 Midtrans will send callback when payment is completed`, "info");
      }
    } catch (error: any) {
      console.error("Error checking transaction:", error);
      addResult(`❌ Error: ${error.message}`, "error");
    } finally {
      setTesting(false);
    }
  };

  const testCallbackEndpoint = async () => {
    try {
      setTesting(true);
      addResult(`🔄 Testing callback endpoint...`, "info");
      
      const response = await fetch("/api/midtrans/callback");
      const data = await response.json();
      
      if (data.ok) {
        addResult(`✅ Callback endpoint is active!`, "success");
        addResult(`Message: ${data.message}`, "info");
      } else {
        addResult(`⚠️ Callback endpoint returned: ${JSON.stringify(data)}`, "info");
      }
    } catch (error: any) {
      addResult(`❌ Error testing callback: ${error.message}`, "error");
    } finally {
      setTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setCurrentOrderId("");
  };

  const refreshTokens = async () => {
    if (!user) {
      addResult("❌ Please login first", "error");
      return;
    }

    try {
      setTesting(true);
      addResult("🔄 Refreshing diamond count...", "info");
      const tokens = await getUserTokens(user.uid);
      setDiamonds(tokens);
      addResult(`✅ Current diamonds: ${tokens.toLocaleString()}`, "success");
    } catch (error: any) {
      addResult(`❌ Error refreshing tokens: ${error.message}`, "error");
    } finally {
      setTesting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#101022] p-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
          <h1 className="text-3xl font-bold text-white mb-2">🧪 Test Midtrans Topup</h1>
          <p className="text-white/70 mb-4">
            Halaman ini untuk testing fitur topup Midtrans. Gunakan untuk debugging dan testing.
          </p>
          
          {user ? (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-white text-sm">
                <span className="font-semibold">Logged in as:</span> {user.email}
              </p>
              <p className="text-white text-sm mt-1">
                <span className="font-semibold">User ID:</span> {user.uid}
              </p>
              <p className="text-white text-sm mt-1">
                <span className="font-semibold">Current Diamonds:</span> <span className="text-primary font-bold">{diamonds.toLocaleString()}</span>
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm">
                ⚠️ Please login first to test topup
              </p>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testCallbackEndpoint}
              disabled={testing}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔍 Test Callback Endpoint
            </button>
            {currentOrderId && (
              <button
                onClick={() => checkTransactionStatus()}
                disabled={testing || !currentOrderId}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Check Transaction Status
              </button>
            )}
            {user && (
              <button
                onClick={refreshTokens}
                disabled={testing}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Refresh Diamonds
              </button>
            )}
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              🗑️ Clear Results
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Test Packages</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-lg bg-[#1A1A1A] p-4 border border-white/10 hover:border-primary/50 transition-colors"
              >
                <h3 className="text-lg font-bold text-white mb-2">{pkg.name}</h3>
                <div className="space-y-1 text-sm text-white/70 mb-4">
                  <p>💎 Diamonds: <span className="text-primary font-semibold">{pkg.diamonds.toLocaleString()}</span></p>
                  {pkg.bonus > 0 && (
                    <p>🎁 Bonus: <span className="text-green-400 font-semibold">+{pkg.bonus.toLocaleString()}</span></p>
                  )}
                  <p>💰 Price: <span className="text-white font-semibold">Rp {pkg.price.toLocaleString("id-ID")}</span></p>
                  <p className="text-xs text-primary">Total: {pkg.diamonds + pkg.bonus} diamonds</p>
                </div>
                <button
                  onClick={() => testCreatePayment(pkg)}
                  disabled={loading || !user}
                  className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Test Topup"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {currentOrderId && (
          <div className="mb-6 rounded-xl bg-[#242424] p-6 shadow-2xl border border-primary/30">
            <h2 className="text-xl font-bold text-white mb-2">📋 Current Order</h2>
            <div className="bg-[#1A1A1A] p-3 rounded-lg">
              <p className="text-white font-mono text-sm break-all">{currentOrderId}</p>
            </div>
            <p className="text-white/70 text-sm mt-2">
              💡 Use this Order ID to check transaction status or test callback manually
            </p>
          </div>
        )}

        <div className="rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">📊 Test Results</h2>
            {results.length > 0 && (
              <button
                onClick={clearResults}
                className="text-sm text-white/70 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-white/50 text-sm">No test results yet. Start testing to see results here.</p>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded-lg text-sm ${
                    result.type === "success"
                      ? "bg-green-500/10 border border-green-500/30 text-green-400"
                      : result.type === "error"
                      ? "bg-red-500/10 border border-red-500/30 text-red-400"
                      : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="break-words flex-1">{result.message}</p>
                    <span className="text-xs opacity-70 ml-2">{result.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[#242424] p-6 shadow-2xl border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">ℹ️ Debugging Info</h2>
          <div className="space-y-2 text-sm text-white/70">
            <p>🔗 Callback URL: <code className="bg-[#1A1A1A] px-2 py-1 rounded">/api/midtrans/callback</code></p>
            <p>🔗 Full Callback URL: <code className="bg-[#1A1A1A] px-2 py-1 rounded break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/midtrans/callback</code></p>
            <p>📝 Collection: <code className="bg-[#1A1A1A] px-2 py-1 rounded">topupTransactions</code></p>
            <p>📝 User Tokens Collection: <code className="bg-[#1A1A1A] px-2 py-1 rounded">userTokens</code></p>
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-yellow-400 text-sm font-semibold mb-1">⚠️ Important Notes:</p>
              <ul className="text-yellow-400/80 text-xs space-y-1 ml-4 list-disc">
                <li>Make sure Firebase Admin SDK is configured in Vercel</li>
                <li>Set FIREBASE_SERVICE_ACCOUNT environment variable (see VERCEL-FIREBASE-ADMIN-SETUP.md)</li>
                <li>Callback URL must be accessible from Midtrans servers</li>
                <li>Check Vercel logs for detailed error messages</li>
                <li>After adding environment variable, redeploy application!</li>
              </ul>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-400 text-sm font-semibold mb-1">📖 Setup Firebase Admin SDK:</p>
              <p className="text-blue-400/80 text-xs">
                If you see "Firebase Admin SDK not initialized" error, follow the setup guide in <code className="bg-[#1A1A1A] px-1 py-0.5 rounded">VERCEL-FIREBASE-ADMIN-SETUP.md</code>
              </p>
              <p className="text-blue-400/80 text-xs mt-1">
                Quick steps: Download service account key → Convert to single-line JSON → Add to Vercel Environment Variables → Redeploy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

