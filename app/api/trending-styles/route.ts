import { NextResponse } from "next/server";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, collection, getDocs, query, where } from "firebase/firestore";
import { Style } from "@/lib/styles";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for server-side
function getServerFirestore(): Firestore {
  const apps = getApps();
  const app: FirebaseApp = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
  return getFirestore(app);
}

// Server-side version of getActiveStyles
async function getActiveStylesServer(db: Firestore): Promise<Style[]> {
  try {
    const stylesRef = collection(db, "styles");
    const q = query(stylesRef, where("status", "==", "Active"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        prompt: data.prompt || "",
        imageUrl: data.imageUrl || "",
        status: data.status || "Active",
        category: data.category || "",
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
      } as Style;
    });
  } catch (error: any) {
    console.error("Error getting active styles:", error);
    return [];
  }
}

// Server-side version of getTrendingStyles
async function getTrendingStylesServer(limit: number = 6): Promise<Style[]> {
  const db = getServerFirestore();

  try {
    // Get all generations to count style usage
    const generationsRef = collection(db, "generations");
    const generationsSnapshot = await getDocs(generationsRef);

    // Count usage for each styleId
    const styleUsageCount: Record<string, number> = {};
    generationsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const styleId = data.styleId;
      if (styleId) {
        styleUsageCount[styleId] = (styleUsageCount[styleId] || 0) + 1;
      }
    });

    // Get all active styles
    const activeStyles = await getActiveStylesServer(db);

    // Add usage count to each style and filter only styles that have been used
    const stylesWithUsage = activeStyles
      .map((style) => ({
        ...style,
        usageCount: styleUsageCount[style.id] || 0,
      }))
      .filter((style) => style.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map(({ usageCount, ...style }) => style); // Remove usageCount from result

    return stylesWithUsage;
  } catch (error: any) {
    console.error("Error getting trending styles:", error);
    // Fallback: return first 6 active styles if error occurs
    try {
      const activeStyles = await getActiveStylesServer(db);
      return activeStyles.slice(0, limit);
    } catch (fallbackError) {
      console.error("Error in fallback:", fallbackError);
      return [];
    }
  }
}

export async function GET() {
  try {
    const trendingStyles = await getTrendingStylesServer(6);
    return NextResponse.json({
      ok: true,
      styles: trendingStyles,
    });
  } catch (error: any) {
    console.error("Error getting trending styles:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to get trending styles",
        styles: [],
      },
      { status: 500 }
    );
  }
}

