import type { NextConfig } from "next";

const backendOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
