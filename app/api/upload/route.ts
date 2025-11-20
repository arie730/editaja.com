import { NextRequest, NextResponse } from "next/server";
import { getGeneralSettings } from "@/lib/settings";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const type = formData.get("type") as string; // "original", "generated", or "style"

    console.log("Upload request received:", { 
      hasFile: !!file, 
      fileName: file?.name, 
      fileSize: file?.size,
      userId, 
      type 
    });

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 }
      );
    }

    let uploadsDir: string;
    let publicUrl: string;

    // Only handle style images locally, user uploads go to gambar.editaja.com
    if (type === "style") {
      // For style preview images, save to public/uploads/styles/
      uploadsDir = path.join(process.cwd(), "public", "uploads", "styles");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      // Generate unique filename for style
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileExtension = file.name.split(".").pop() || "jpg";
      const filename = `style_${timestamp}_${randomStr}.${fileExtension}`;
      const filePath = path.join(uploadsDir, filename);

      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Write file to disk
      await writeFile(filePath, buffer);

      // Return public URL
      const publicUrl = `/uploads/styles/${filename}`;
      return NextResponse.json({
        ok: true,
        url: publicUrl,
      });
    }

    // For user uploads (original), upload directly to gambar.editaja.com
    if (type === "original") {
      const GAMBAR_SERVER_URL = process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL || "https://gambar.editaja.com";
      const GAMBAR_API_TOKEN = process.env.GAMBAR_API_TOKEN || process.env.NEXT_PUBLIC_GAMBAR_API_TOKEN || "arie";
      
      console.log("Uploading user image to gambar.editaja.com...");
      
      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileExtension = file.name.split(".").pop() || "jpg";
      
      // Create multipart/form-data for upload.php
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const formDataParts: Buffer[] = [];
      
      // Add file field
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`));
      formDataParts.push(Buffer.from(`Content-Type: ${file.type || `image/${fileExtension}`}\r\n\r\n`));
      formDataParts.push(buffer);
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Add user_id field
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="user_id"\r\n\r\n`));
      formDataParts.push(Buffer.from(userId || "anonymous"));
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Add image_type field (upload = gambar yang di-upload user)
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="image_type"\r\n\r\n`));
      formDataParts.push(Buffer.from("upload"));
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Get watermark setting from Firestore (for user uploads, always enable watermark)
      let watermarkEnabled = true; // User uploads always have watermark
      try {
        const generalSettings = await getGeneralSettings();
        watermarkEnabled = generalSettings.watermarkEnabled !== undefined ? generalSettings.watermarkEnabled : true;
      } catch (error) {
        console.warn("Failed to get watermark setting, using default (enabled):", error);
      }
      
      // Add watermark_enabled field
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="watermark_enabled"\r\n\r\n`));
      formDataParts.push(Buffer.from(watermarkEnabled ? "1" : "0"));
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Add closing boundary
      formDataParts.push(Buffer.from(`--${boundary}--\r\n`));
      
      const formDataBuffer = Buffer.concat(formDataParts);
      
      const uploadResponse = await fetch(`${GAMBAR_SERVER_URL}/upload.php`, {
        method: "POST",
        headers: {
          "Authorization": GAMBAR_API_TOKEN,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": formDataBuffer.length.toString(),
        },
        body: formDataBuffer,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || uploadResponse.statusText };
        }
        console.error("Failed to upload to gambar.editaja.com:", errorData);
        return NextResponse.json(
          { ok: false, error: errorData.message || "Failed to upload image to gambar.editaja.com" },
          { status: uploadResponse.status }
        );
      }
      
      const uploadData = await uploadResponse.json();
      if (uploadData.status === 'success') {
        console.log("✅ User image uploaded to gambar.editaja.com:", {
          optimized: uploadData.optimized_url,
          original: uploadData.original_url
        });
        return NextResponse.json({
          ok: true,
          url: uploadData.optimized_url, // Use optimized URL for display
          original_url: uploadData.original_url,
          optimized_url: uploadData.optimized_url,
        });
      } else {
        return NextResponse.json(
          { ok: false, error: uploadData.message || "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // For generated images, they should use /api/image/save-generated instead
    return NextResponse.json(
      { ok: false, error: "Invalid type. Use /api/image/save-generated for generated images." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { ok: false, error: "URL is required" },
        { status: 400 }
      );
    }

    // Extract file path from URL
    let filePath: string;
    if (url.startsWith("/uploads/")) {
      // Remove leading slash and construct full path
      filePath = path.join(process.cwd(), "public", url);
    } else if (url.includes("/uploads/")) {
      // Extract path after /uploads/
      const uploadsIndex = url.indexOf("/uploads/");
      const relativePath = url.substring(uploadsIndex);
      filePath = path.join(process.cwd(), "public", relativePath);
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Check if file exists
    if (existsSync(filePath)) {
      await unlink(filePath);
      return NextResponse.json({ ok: true, message: "File deleted successfully" });
    } else {
      // File doesn't exist, but return success anyway (idempotent)
      return NextResponse.json({ ok: true, message: "File not found (already deleted)" });
    }
  } catch (error: any) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete file" },
      { status: 500 }
    );
  }
}



