import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, userId } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Extract filename from URL
    // URL format: https://gambar.editaja.com/uploads/original/{user_id}/editaja.com_img_YYYYMMDD_HHMMSS_uniqid.ext
    // or: https://gambar.editaja.com/uploads/optimized/original/{user_id}/editaja.com_img_YYYYMMDD_HHMMSS_uniqid.webp
    let filename: string | null = null;
    try {
      const urlObj = new URL(imageUrl);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      // Find the part that contains 'editaja.com_img_' (the filename)
      const filenamePart = pathParts.find(part => part.includes('editaja.com_img_'));
      if (filenamePart) {
        filename = filenamePart;
      } else {
        // Fallback: get the last part (should be filename)
        filename = pathParts[pathParts.length - 1];
      }
    } catch (e) {
      console.error("Error parsing URL:", e);
    }

    if (!filename || !filename.includes('editaja.com')) {
      return NextResponse.json(
        { ok: false, error: "Could not extract valid filename from URL" },
        { status: 400 }
      );
    }

    // Get gambar server URL and API token
    const GAMBAR_SERVER_URL = process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL || "https://gambar.editaja.com";
    const GAMBAR_API_TOKEN = process.env.GAMBAR_API_TOKEN || process.env.NEXT_PUBLIC_GAMBAR_API_TOKEN || "arie";

    console.log(`Deleting image from gambar.editaja.com: ${filename}`);

    // Call delete.php to delete the image
    const deleteResponse = await fetch(`${GAMBAR_SERVER_URL}/delete.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": GAMBAR_API_TOKEN,
      },
      body: JSON.stringify({ 
        id: filename,
        user_id: userId || undefined
      }),
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text().catch(() => '');
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || deleteResponse.statusText };
      }
      console.error("Failed to delete image from gambar.editaja.com:", errorData);
      return NextResponse.json(
        { ok: false, error: errorData.message || "Failed to delete image" },
        { status: deleteResponse.status }
      );
    }

    const deleteData = await deleteResponse.json();
    
    if (deleteData.status === 'success') {
      console.log("✅ Image deleted from gambar.editaja.com:", {
        id: deleteData.deleted,
        files_deleted: deleteData.files_deleted
      });
      
      return NextResponse.json({
        ok: true,
        message: "Image deleted successfully",
        deleted: deleteData.deleted,
        files_deleted: deleteData.files_deleted,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: deleteData.message || "Failed to delete image" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete image" },
      { status: 500 }
    );
  }
}

