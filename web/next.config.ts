import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Everything under /api proxies to FastAPI except the routes Next.js serves itself (auth, me)
        source: "/api/:path((?!(?:auth|me)(?:/|$)).*)",
        destination: `${process.env.API_INTERNAL_URL ?? "http://openseldon-api:8000"}/:path`,
      },
    ];
  },
};

export default nextConfig;
