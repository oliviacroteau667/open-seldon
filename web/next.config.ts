import type { NextConfig } from "next";

// trim: a stray tab/space pasted into the env var once broke the build with "Invalid rewrite"
const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://openseldon-api:8000").trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Everything under /api proxies to FastAPI except the routes Next.js serves itself (auth, me)
        source: "/api/:path((?!(?:auth|me)(?:/|$)).*)",
        destination: `${API_INTERNAL_URL}/:path`,
      },
    ];
  },
};

export default nextConfig;
