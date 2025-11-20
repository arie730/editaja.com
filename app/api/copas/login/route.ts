import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const REQUIRED_PASSWORD = "kmzwa78saa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (password === REQUIRED_PASSWORD) {
      const cookieStore = await cookies();
      cookieStore.set("copas_authenticated", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: "Password salah!" },
        { status: 401 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const authenticated = cookieStore.get("copas_authenticated")?.value === "true";

  return NextResponse.json({ authenticated });
}


