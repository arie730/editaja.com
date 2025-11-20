import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get gambar server URL and API token
    const GAMBAR_SERVER_URL = process.env.NEXT_PUBLIC_GAMBAR_SERVER_URL || "https://gambar.editaja.com";
    const GAMBAR_API_TOKEN = process.env.GAMBAR_API_TOKEN || process.env.NEXT_PUBLIC_GAMBAR_API_TOKEN || "arie";

    console.log(`Deleting user folders from gambar.editaja.com for user: ${userId}`);

    // Call delete-user.php to delete all user folders
    const deleteResponse = await fetch(`${GAMBAR_SERVER_URL}/delete-user.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": GAMBAR_API_TOKEN,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text().catch(() => '');
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || deleteResponse.statusText };
      }
      console.error("Failed to delete user folders from gambar.editaja.com:", errorData);
      return NextResponse.json(
        { ok: false, error: errorData.message || "Failed to delete user folders" },
        { status: deleteResponse.status }
      );
    }

    const deleteData = await deleteResponse.json();
    
    if (deleteData.status === 'success') {
      console.log("✅ User folders deleted from gambar.editaja.com:", {
        user_id: deleteData.user_id,
        deleted_folders: deleteData.deleted_folders,
        deleted_files: deleteData.deleted_files
      });
      
      return NextResponse.json({
        ok: true,
        message: "User folders deleted successfully",
        deleted_folders: deleteData.deleted_folders,
        deleted_files: deleteData.deleted_files,
      });
    } else {
      return NextResponse.json(
        { ok: false, error: deleteData.message || "Failed to delete user folders" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error deleting user folders:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete user folders" },
      { status: 500 }
    );
  }
}

