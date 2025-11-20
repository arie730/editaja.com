import { NextRequest, NextResponse } from "next/server";

// Get user location from IP address
export async function GET(request: NextRequest) {
  try {
    // Get IP address from request headers
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded 
      ? forwarded.split(",")[0].trim() 
      : realIp || "unknown";

    // For localhost or development, return default
    if (ip === "unknown" || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127")) {
      return NextResponse.json({
        country: "Unknown",
        city: "Unknown",
        ip: ip,
      });
    }

    try {
      // Try ip-api.com first (free tier: 45 requests/minute, no API key needed)
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,query`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success") {
          return NextResponse.json({
            country: data.country || "Unknown",
            city: data.city || "Unknown",
            ip: data.query || ip,
            countryCode: "",
          });
        }
      }
    } catch (error) {
      console.error("Error with ip-api.com:", error);
    }

    try {
      // Fallback: Try ipapi.co (free tier: 1000 requests/day)
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          return NextResponse.json({
            country: data.country_name || "Unknown",
            city: data.city || "Unknown",
            ip: ip,
            countryCode: data.country_code || "",
          });
        }
      }
    } catch (error) {
      console.error("Error with ipapi.co:", error);
    }

    // If all fails, return unknown
    return NextResponse.json({
      country: "Unknown",
      city: "Unknown",
      ip: ip,
    });
  } catch (error: any) {
    console.error("Error getting geolocation:", error);
    return NextResponse.json(
      {
        country: "Unknown",
        city: "Unknown",
        ip: "unknown",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

