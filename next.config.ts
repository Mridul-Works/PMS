import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a test build run in a separate folder without touching the dev server's .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
