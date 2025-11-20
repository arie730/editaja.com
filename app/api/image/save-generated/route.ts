import { NextRequest, NextResponse } from "next/server";
import { getGeneralSettings } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, userId, index } = body;

    if (!imageUrl || !userId) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`Saving generated image ${index || 0}:`, { imageUrl, userId });

    // Get gambar server URL from environment variable
    const GAMBAR_SERVER_URL = process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL || "https://gambar.editaja.com";
    
    console.log(`[Save Generated] Using gambar server URL: ${GAMBAR_SERVER_URL}`);
    console.log(`[Save Generated] Environment variable NEXT_PUBLIC_GAMBAR_SERVER_URL:`, process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL || "not set (using default)");
    
    // Download image from CDN
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
    } catch (fetchError: any) {
      console.error("Error downloading image from CDN:", fetchError);
      return NextResponse.json(
        { ok: false, error: `Failed to download image: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error("Downloaded image is empty");
    }

    // Detect file extension from Content-Type or URL
    let fileExtension = "jpg"; // default
    const contentType = imageResponse.headers.get("content-type");
    const urlExtension = imageUrl.split(".").pop()?.split("?")[0]?.toLowerCase();
    
    if (contentType) {
      if (contentType.includes("png")) {
        fileExtension = "png";
      } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        fileExtension = "jpg";
      } else if (contentType.includes("webp")) {
        fileExtension = "webp";
      } else if (urlExtension && ["png", "jpg", "jpeg", "webp"].includes(urlExtension)) {
        fileExtension = urlExtension;
      }
    } else if (urlExtension && ["png", "jpg", "jpeg", "webp"].includes(urlExtension)) {
      fileExtension = urlExtension;
    }

    // Validate file signature (magic bytes)
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWEBP = buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    
    const isValidImage = isJPEG || isPNG || isWEBP;

    if (!isValidImage) {
      console.warn("Warning: File signature doesn't match expected image format");
      const firstBytes = Array.from(buffer.slice(0, 12));
      console.warn(`First bytes: ${firstBytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
    } else {
      // Auto-correct extension based on actual file signature
      if (isPNG && fileExtension !== "png") {
        console.log(`Auto-correcting extension from ${fileExtension} to png (detected PNG signature)`);
        fileExtension = "png";
      } else if (isJPEG && fileExtension !== "jpg" && fileExtension !== "jpeg") {
        console.log(`Auto-correcting extension from ${fileExtension} to jpg (detected JPEG signature)`);
        fileExtension = "jpg";
      } else if (isWEBP && fileExtension !== "webp") {
        console.log(`Auto-correcting extension from ${fileExtension} to webp (detected WEBP signature)`);
        fileExtension = "webp";
      }
    }

    // Upload to gambar.editaja.com server using upload.php
    try {
      // Get API token from environment variable
      const GAMBAR_API_TOKEN = process.env.GAMBAR_API_TOKEN || process.env.NEXT_PUBLIC_GAMBAR_API_TOKEN || "arie";
      
      const uploadUrl = `${GAMBAR_SERVER_URL}/upload.php`;
      
      console.log(`[Save Generated] Attempting to upload to gambar server: ${uploadUrl}`);
      console.log(`[Save Generated] User ID: ${userId}`);
      
      // Create multipart/form-data manually for Node.js compatibility
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const filename = `generated_${Date.now()}${index !== undefined ? `_${index}` : ''}.${fileExtension}`;
      const contentType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
      
      // Build multipart form data
      const formDataParts: Buffer[] = [];
      
      // Add file field
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`));
      formDataParts.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`));
      formDataParts.push(buffer);
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Add user_id field
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="user_id"\r\n\r\n`));
      formDataParts.push(Buffer.from(userId));
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Add image_type field (generated = hasil generate AI)
      formDataParts.push(Buffer.from(`--${boundary}\r\n`));
      formDataParts.push(Buffer.from(`Content-Disposition: form-data; name="image_type"\r\n\r\n`));
      formDataParts.push(Buffer.from("generated"));
      formDataParts.push(Buffer.from(`\r\n`));
      
      // Get watermark setting from Firestore
      let watermarkEnabled = true; // Default enabled
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
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": GAMBAR_API_TOKEN,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": formDataBuffer.length.toString(),
        },
        body: formDataBuffer,
      });

      console.log(`[Save Generated] Upload response status: ${uploadResponse.status} ${uploadResponse.statusText}`);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || uploadResponse.statusText };
        }
        console.error(`[Save Generated] Upload failed:`, {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData,
        });
        throw new Error(`Failed to upload to gambar server: ${uploadResponse.status} ${errorData.message || uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      
      if (uploadData.status === 'success' && uploadData.optimized_url) {
        // Return optimized URL (thumbnail) from gambar server
        const optimizedUrl = uploadData.optimized_url;
        const originalUrl = uploadData.original_url;

        console.log(`[Save Generated] Image uploaded to gambar server successfully:`, {
          optimized: optimizedUrl,
          original: originalUrl,
          file_id: uploadData.file_id,
          user_id: uploadData.user_id
        });

        return NextResponse.json({
          ok: true,
          url: optimizedUrl, // Use optimized URL for display (thumbnail)
          original_url: originalUrl, // Also return original URL
          optimized_url: optimizedUrl,
          file_id: uploadData.file_id,
          user_id: uploadData.user_id,
        });
      } else {
        throw new Error(uploadData.message || "Invalid response from gambar server");
      }
    } catch (uploadError: any) {
      console.error("Error uploading to gambar server:", uploadError);
      // Don't fallback to local storage - throw error instead
      throw new Error(`Failed to upload to gambar.editaja.com: ${uploadError.message}`);
    }
  } catch (error: any) {
    console.error("Error saving generated image:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to save image" },
      { status: 500 }
    );
  }
}

