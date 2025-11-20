import { NextResponse } from "next/server";
import { getMidtransConfig } from "@/lib/settings";

export async function GET() {
  try {
    const config = await getMidtransConfig();
    
    if (!config || !config.clientKey) {
      return NextResponse.json({
        ok: false,
        error: "Midtrans configuration not found. Please configure Midtrans in admin settings.",
      });
    }

    return NextResponse.json({
      ok: true,
      clientKey: config.clientKey,
      isProduction: config.isProduction,
    });
  } catch (error: any) {
    console.error("Error getting Midtrans config:", error);
    
    // Check for specific error types
    let errorMessage = error.message || "Internal server error";
    
    if (error.message?.includes("quota") || error.message?.includes("exceeded")) {
      errorMessage = "Firestore quota exceeded. Please check your Firebase plan or wait for quota reset.";
    } else if (error.message?.includes("not initialized")) {
      errorMessage = "Firestore not initialized. Please check your Firebase configuration.";
    }
    
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

