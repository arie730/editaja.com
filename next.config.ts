import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression
  compress: true,
  
  // Optimize production builds
  swcMinify: true,
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "copasprompt.id",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn-magnific.freepik.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gambar.editaja.com",
        port: "",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          // Add caching headers for static assets
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  
  // Optimize bundle size
  experimental: {
    optimizePackageImports: ["firebase", "firebase-admin"],
  },

  // Increase body size limit for API routes (default is 1MB, increase to 50MB)
  // Note: Vercel functions have their own limits (4.5MB for Hobby, 50MB for Pro)
  serverRuntimeConfig: {
    maxRequestBodySize: 50 * 1024 * 1024, // 50MB
  },
};

export default nextConfig;
