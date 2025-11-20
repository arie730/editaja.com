import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];

    // Verify Firebase token
    try {
      const verifyResponse = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!verifyResponse.ok) {
        throw new Error("Token verification failed");
      }

      const verifyData = await verifyResponse.json();
      if (!verifyData.users || verifyData.users.length === 0) {
        throw new Error("User not found");
      }
    } catch (error: any) {
      console.error("Token verification error:", error);
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // "logo" or "favicon"

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!type || (type !== "logo" && type !== "favicon")) {
      return NextResponse.json(
        { ok: false, error: "Invalid type. Must be 'logo' or 'favicon'" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/") && !file.name.endsWith(".ico")) {
      return NextResponse.json(
        { ok: false, error: "File must be an image or .ico file" },
        { status: 400 }
      );
    }

    // Validate file size
    const maxSize = type === "logo" ? 2 * 1024 * 1024 : 1 * 1024 * 1024; // 2MB for logo, 1MB for favicon
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: `File size must be less than ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Create settings directory if it doesn't exist
    const settingsDir = path.join(process.cwd(), "public", "uploads", "settings");
    if (!existsSync(settingsDir)) {
      await mkdir(settingsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || (type === "favicon" ? "ico" : "png");
    const filename = `${type}_${timestamp}.${fileExtension}`;
    const filePath = path.join(settingsDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return public URL
    const publicUrl = `/uploads/settings/${filename}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
    });
  } catch (error: any) {
    console.error("Error uploading settings file:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}



