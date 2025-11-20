import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = "https://chatgambar.com/api/v1/viral-prompts";
const CACHE_TTL = 300; // 5 minutes
const IMG_ORIGIN = "https://copasprompt.id";
const USE_NEXT_OPTIMIZER = true;
const OPTIMIZER_WIDTH = 640;
const OPTIMIZER_QUALITY = 100;

// Simple in-memory cache (in production, use Redis or similar)
let cacheData: { data: any; timestamp: number } | null = null;

function cleanJsonString(s: string): string {
  // Remove BOM
  s = s.replace(/^\uFEFF/, "");
  // Remove control characters except newlines and tabs
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return s;
}

function normalizeItems(decoded: any): any[] {
  if (!decoded) return [];

  if (Array.isArray(decoded) && decoded[0] && typeof decoded[0] === "object") {
    if ("data" in decoded[0] && Array.isArray(decoded[0].data)) {
      return decoded[0].data;
    }
    return decoded;
  }

  if (decoded && typeof decoded === "object" && "data" in decoded && Array.isArray(decoded.data)) {
    return decoded.data;
  }

  if (decoded && typeof decoded === "object" && ("id" in decoded || "prompt" in decoded || "image" in decoded)) {
    return [decoded];
  }

  return [];
}

function imageUrl(img: string | undefined): string {
  if (!img) return "";
  if (/^https?:\/\//i.test(img)) return img;
  if (img[0] !== "/") img = "/" + img;

  if (USE_NEXT_OPTIMIZER) {
    const urlParam = encodeURIComponent(img);
    return `${IMG_ORIGIN}/_next/image?url=${urlParam}&w=${OPTIMIZER_WIDTH}&q=${OPTIMIZER_QUALITY}`;
  } else {
    return `${IMG_ORIGIN}${img}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const authenticated = cookieStore.get("copas_authenticated")?.value === "true";

    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache
    const now = Date.now();
    if (cacheData && now - cacheData.timestamp < CACHE_TTL * 1000) {
      return NextResponse.json({ data: cacheData.data });
    }

    // Fetch from API
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ViralPrompts-NextJS/1.0",
      },
      next: { revalidate: CACHE_TTL },
    });

    if (!response.ok) {
      // Return cached data if available
      if (cacheData) {
        return NextResponse.json({ data: cacheData.data });
      }
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: response.status }
      );
    }

    const raw = await response.text();
    const clean = cleanJsonString(raw);
    let decoded = JSON.parse(clean);

    if (!decoded) {
      const clean2 = clean.replace(/[^\P{C}\t\r\n]/gu, "");
      decoded = JSON.parse(clean2);
    }

    const items = normalizeItems(decoded);

    // Process items with image URLs
    const processedItems = items.map((item: any) => ({
      ...item,
      imageUrl: imageUrl(item.image),
    }));

    // Update cache
    cacheData = {
      data: processedItems,
      timestamp: now,
    };

    return NextResponse.json({ data: processedItems });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    // Return cached data if available
    if (cacheData) {
      return NextResponse.json({ data: cacheData.data });
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


