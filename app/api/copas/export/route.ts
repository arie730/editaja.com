import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const API_URL = "https://chatgambar.com/api/v1/viral-prompts";
const IMG_ORIGIN = "https://copasprompt.id";
const BATCH_SIZE = 50;

// Helper functions (same as data route)
function cleanJsonString(s: string): string {
  s = s.replace(/^\uFEFF/, "");
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

function extractImagePath(img: string | undefined): string {
  if (!img) return "";
  if (/^https?:\/\//i.test(img)) {
    try {
      const url = new URL(img);
      let path = url.pathname;
      if (path.includes("/_next/image")) {
        const urlParam = url.searchParams.get("url");
        if (urlParam) {
          path = decodeURIComponent(urlParam);
        }
      }
      if (path && path[0] !== "/") path = "/" + path;
      return path;
    } catch {
      return "";
    }
  }
  if (img[0] !== "/") img = "/" + img;
  return img;
}

async function downloadImage(imgPath: string, localPath: string): Promise<boolean> {
  try {
    if (fs.existsSync(localPath)) {
      return true;
    }

    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sourceUrl = `${IMG_ORIGIN}${imgPath}`;
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "ViralPrompts-NextJS/1.0",
      },
    });

    if (!response.ok) {
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authenticated = cookieStore.get("copas_authenticated")?.value === "true";

    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const batchIndex = parseInt(searchParams.get("batch") || "0");

    if (action === "prepare_export") {
      // Fetch all items
      const response = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ViralPrompts-NextJS/1.0",
        },
      });

      if (!response.ok) {
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
      const batches = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      if (batchIndex >= batches.length) {
        return NextResponse.json(
          { error: "Batch index tidak valid" },
          { status: 400 }
        );
      }

      const batchItems = batches[batchIndex];
      const totalImages = batchItems.filter((it: any) => it.image).length;

      return NextResponse.json({
        status: "started",
        batchIndex,
        totalBatches: batches.length,
        total: totalImages,
      });
    }

    if (action === "download_images") {
      // Fetch all items
      const response = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ViralPrompts-NextJS/1.0",
        },
      });

      if (!response.ok) {
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
      const batches = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      if (batchIndex >= batches.length) {
        return NextResponse.json(
          { error: "Batch index tidak valid" },
          { status: 400 }
        );
      }

      const batchItems = batches[batchIndex];
      const imagesDir = path.join(process.cwd(), "public", "images", "copas");
      
      // Ensure directory exists
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      let downloaded = 0;
      let failed = 0;
      let skipped = 0;

      for (const item of batchItems) {
        if (!item.image) continue;

        const imgPath = extractImagePath(item.image);
        if (!imgPath) continue;

        let localPath = imgPath.replace(/^\/images\//, "").replace(/^\//, "");
        const fullPath = path.join(imagesDir, localPath);

        if (fs.existsSync(fullPath)) {
          skipped++;
          downloaded++;
        } else {
          if (await downloadImage(imgPath, fullPath)) {
            downloaded++;
          } else {
            failed++;
          }
        }
      }

      return NextResponse.json({
        status: "completed",
        result: {
          downloaded,
          failed,
          skipped,
          total: batchItems.filter((it: any) => it.image).length,
        },
        batchIndex,
      });
    }

    if (action === "get_export_file") {
      // Fetch all items
      const response = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ViralPrompts-NextJS/1.0",
        },
      });

      if (!response.ok) {
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
      const batches = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      if (batchIndex >= batches.length) {
        return NextResponse.json(
          { error: "Batch index tidak valid" },
          { status: 400 }
        );
      }

      const batchItems = batches[batchIndex];
      const imagesDir = path.join(process.cwd(), "public", "images", "copas");
      
      // Ensure directory exists
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      // Use production domain from env or fallback to editaja.com
      // This ensures exported JSON always uses production URL, not localhost
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                      (process.env.NEXT_PUBLIC_VERCEL_URL ? 
                        `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 
                        "https://editaja.com");

      const exportData = batchItems.map((item: any) => {
        let imageUrl = "";
        if (item.image) {
          const imgPath = extractImagePath(item.image);
          if (imgPath) {
            let localPath = imgPath.replace(/^\/images\//, "").replace(/^\//, "");
            imageUrl = `${baseUrl}/images/copas/${localPath}`;
          }
        }

        return {
          prompt: item.prompt || "",
          imageUrl,
          status: "Active",
          category: item.category || "",
          tags: Array.isArray(item.tags) ? item.tags : [],
        };
      });

      const json = JSON.stringify(exportData, null, 2);
      const filename = `viral-prompts-export-batch-${batchIndex + 1}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.json`;

      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

