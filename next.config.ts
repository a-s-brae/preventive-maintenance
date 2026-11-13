import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSV imports (up to 2 MB of text) are sent to a server action.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [
      {
        // Other sites can't show these pages inside a frame (clickjacking).
        // Attachments (/files) set their own, stricter policy.
        source: "/((?!files/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
