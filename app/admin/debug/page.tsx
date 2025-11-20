"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { checkAdminStatus } from "@/lib/auth";

export default function AdminDebugPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAdminDebug = async () => {
    if (!user || !db) {
      setDebugInfo({
        error: "User not logged in or Firestore not initialized",
        user: user ? "Logged in" : "Not logged in",
        db: db ? "Initialized" : "Not initialized",
      });
      return;
    }

    setLoading(true);
    try {
      const uid = user.uid;
      const email = user.email;

      // Check if document exists
      const adminDocRef = doc(db, "admins", uid);
      const adminDoc = await getDoc(adminDocRef);

      const adminData = adminDoc.exists() ? adminDoc.data() : null;
      const isAdminCheck = await checkAdminStatus(uid);

      setDebugInfo({
        uid,
        email,
        documentExists: adminDoc.exists(),
        documentId: adminDoc.exists() ? adminDoc.id : "N/A",
        documentData: adminData,
        isAdminField: adminData?.isAdmin,
        isAdminFieldType: typeof adminData?.isAdmin,
        isAdminCheckResult: isAdminCheck,
        contextIsAdmin: isAdmin,
        firestoreRules: "Check Firestore console for rules",
        recommendations: [
          !adminDoc.exists() && "❌ Document does not exist in 'admins' collection",
          adminDoc.exists() && adminData?.isAdmin !== true && "❌ Field 'isAdmin' is not true (boolean)",
          adminDoc.exists() && typeof adminData?.isAdmin === "string" && "❌ Field 'isAdmin' is string, should be boolean",
          adminDoc.exists() && adminDoc.id !== uid && "❌ Document ID does not match user UID",
          adminDoc.exists() && adminData?.isAdmin === true && "✅ Document exists and isAdmin is true",
        ].filter(Boolean),
      });
    } catch (error: any) {
      setDebugInfo({
        error: error.message,
        errorCode: error.code,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      checkAdminDebug();
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101022]">
        <div className="text-center text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#101022] p-4">
        <div className="max-w-2xl w-full bg-[#242424] rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-4">Admin Debug Tool</h1>
          <p className="text-red-400 mb-4">❌ You are not logged in.</p>
          <a href="/admin" className="text-primary hover:underline">
            Go to Admin Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#101022] p-4">
      <div className="max-w-4xl w-full bg-[#242424] rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Admin Debug Tool</h1>

        <div className="mb-6 p-4 bg-[#1A1A1A] rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">User Info</h2>
          <div className="space-y-1 text-sm text-[#EAEAEA]">
            <p>UID: <span className="font-mono text-primary">{user.uid}</span></p>
            <p>Email: <span className="font-mono text-primary">{user.email}</span></p>
            <p>Context isAdmin: <span className={isAdmin ? "text-green-400" : "text-red-400"}>{isAdmin ? "✅ true" : "❌ false"}</span></p>
          </div>
        </div>

        <button
          onClick={checkAdminDebug}
          disabled={loading}
          className="mb-6 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh Debug Info"}
        </button>

        {debugInfo && (
          <div className="space-y-4">
            {debugInfo.error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <h3 className="text-red-400 font-semibold mb-2">Error</h3>
                <pre className="text-xs text-red-300 whitespace-pre-wrap">{JSON.stringify(debugInfo.error, null, 2)}</pre>
              </div>
            )}

            <div className="p-4 bg-[#1A1A1A] rounded-lg">
              <h3 className="text-white font-semibold mb-2">Firestore Check</h3>
              <div className="space-y-2 text-sm">
                <p className="text-[#EAEAEA]">
                  Document Exists:{" "}
                  <span className={debugInfo.documentExists ? "text-green-400" : "text-red-400"}>
                    {debugInfo.documentExists ? "✅ Yes" : "❌ No"}
                  </span>
                </p>
                <p className="text-[#EAEAEA]">
                  Document ID: <span className="font-mono text-primary">{debugInfo.documentId}</span>
                </p>
                <p className="text-[#EAEAEA]">
                  UID: <span className="font-mono text-primary">{debugInfo.uid}</span>
                </p>
                <p className="text-[#EAEAEA]">
                  ID Match:{" "}
                  <span className={debugInfo.documentId === debugInfo.uid ? "text-green-400" : "text-red-400"}>
                    {debugInfo.documentId === debugInfo.uid ? "✅ Yes" : "❌ No"}
                  </span>
                </p>
                <p className="text-[#EAEAEA]">
                  isAdmin Field:{" "}
                  <span className={debugInfo.isAdminField === true ? "text-green-400" : "text-red-400"}>
                    {debugInfo.isAdminField !== undefined ? String(debugInfo.isAdminField) : "undefined"}
                  </span>
                </p>
                <p className="text-[#EAEAEA]">
                  isAdmin Type: <span className="font-mono text-yellow-400">{debugInfo.isAdminFieldType}</span>
                </p>
                <p className="text-[#EAEAEA]">
                  checkAdminStatus():{" "}
                  <span className={debugInfo.isAdminCheckResult ? "text-green-400" : "text-red-400"}>
                    {debugInfo.isAdminCheckResult ? "✅ true" : "❌ false"}
                  </span>
                </p>
              </div>
            </div>

            {debugInfo.documentData && (
              <div className="p-4 bg-[#1A1A1A] rounded-lg">
                <h3 className="text-white font-semibold mb-2">Document Data</h3>
                <pre className="text-xs text-[#EAEAEA] whitespace-pre-wrap bg-[#111118] p-4 rounded">
                  {JSON.stringify(debugInfo.documentData, null, 2)}
                </pre>
              </div>
            )}

            {debugInfo.recommendations && debugInfo.recommendations.length > 0 && (
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <h3 className="text-yellow-400 font-semibold mb-2">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300">
                  {debugInfo.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
              <h3 className="text-blue-400 font-semibold mb-2">How to Fix</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-300">
                <li>Go to Firebase Console → Firestore Database</li>
                <li>Check if collection <span className="font-mono">admins</span> exists</li>
                <li>Check if document with ID = <span className="font-mono bg-[#111118] px-2 py-1 rounded">{debugInfo.uid}</span> exists</li>
                <li>If document doesn't exist:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Create new document</li>
                    <li>Document ID: <span className="font-mono bg-[#111118] px-2 py-1 rounded">{debugInfo.uid}</span> (NOT email!)</li>
                    <li>Add field: <span className="font-mono bg-[#111118] px-2 py-1 rounded">email</span> (string) = {debugInfo.email}</li>
                    <li>Add field: <span className="font-mono bg-[#111118] px-2 py-1 rounded">isAdmin</span> (boolean) = <span className="font-mono">true</span></li>
                  </ul>
                </li>
                <li>If document exists but isAdmin is not true:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Edit the document</li>
                    <li>Change <span className="font-mono bg-[#111118] px-2 py-1 rounded">isAdmin</span> to <span className="font-mono">true</span> (boolean, not string!)</li>
                  </ul>
                </li>
                <li>Refresh this page after making changes</li>
              </ol>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-4">
          <a
            href="/admin"
            className="px-4 py-2 bg-[#1A1A1A] text-white rounded-lg hover:bg-[#2A2A2A]"
          >
            Back to Admin Login
          </a>
        </div>
      </div>
    </div>
  );
}





