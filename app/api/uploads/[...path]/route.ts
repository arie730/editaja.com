import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * API route to serve uploaded files from public/uploads/
 * This is a fallback in case Next.js static file serving doesn't work
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } | Promise<{ path: string[] }> }
) {
  try {
    // Handle both Next.js 16 (direct) and Next.js 15+ (Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    
    // Reconstruct the path from params
    const pathArray = resolvedParams.path || [];
    const filePath = pathArray.join("/");
    
    // Path should be like: "spS5RZ6UYeXKZHl9HuhVgqVVBBR2/generated_1763405139804_0.jpg"
    // We need to prepend "uploads/" to it
    const fullFilePath = `uploads/${filePath}`;
    
    // Construct full file path
    const fullPath = path.join(process.cwd(), "public", fullFilePath);
    
    // Check if file exists
    if (!existsSync(fullPath)) {
      console.error(`[API Uploads] File not found: ${fullPath}`);
      return NextResponse.json(
        { error: "File not found", path: fullPath },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(fullPath);
    
    // Validate file is not empty
    if (!fileBuffer || fileBuffer.length === 0) {
      console.error("[API Uploads] File is empty:", fullPath);
      return NextResponse.json(
        { error: "File is empty" },
        { status: 500 }
      );
    }
    
    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = "application/octet-stream";
    
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".svg":
        contentType = "image/svg+xml";
        break;
    }
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[API Uploads] Error serving file:", error);
    return NextResponse.json(
      { error: error.message || "Failed to serve file" },
      { status: 500 }
    );
  }
}


