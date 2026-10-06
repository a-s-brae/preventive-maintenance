import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSV imports (up to 2 MB of text) are sent to a server action.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
