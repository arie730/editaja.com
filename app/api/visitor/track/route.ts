import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      // Return success even if Firestore is not initialized
      // This is a non-critical feature
      return NextResponse.json({ ok: true, message: "Firestore not initialized, skipping server-side tracking" });
    }

    const body = await request.json();
    const { sessionId, page, userId } = body;

    if (!sessionId || !page) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get IP address and user agent from request
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const referrer = request.headers.get("referer") || "";

    try {
      // Save visitor data to Firestore
      const visitorRef = doc(db, "visitors", sessionId);
      const visitorSnap = await getDoc(visitorRef);

      const visitorData: any = {
        sessionId,
        page,
        ipAddress,
        userAgent,
        referrer,
        lastSeenAt: serverTimestamp(),
        isActive: true,
      };

      if (userId) {
        visitorData.userId = userId;
      }

      if (visitorSnap.exists()) {
        // Update existing visitor
        await setDoc(visitorRef, visitorData, { merge: true });
      } else {
        // Create new visitor
        await setDoc(visitorRef, {
          ...visitorData,
          createdAt: serverTimestamp(),
        });
      }

      return NextResponse.json({ ok: true });
    } catch (firestoreError: any) {
      // Log error but return success - this is non-critical
      console.error("Error saving visitor to Firestore (non-critical):", firestoreError);
      return NextResponse.json({ 
        ok: true, 
        message: "Client-side tracking will handle this",
        warning: firestoreError.message 
      });
    }
  } catch (error: any) {
    // Log error but return success - visitor tracking should not break the app
    console.error("Error in visitor tracking API (non-critical):", error);
    return NextResponse.json({ 
      ok: true, 
      message: "Client-side tracking will handle this",
      warning: error.message 
    });
  }
}

