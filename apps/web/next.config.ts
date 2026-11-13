import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@citacs/shared"],
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
