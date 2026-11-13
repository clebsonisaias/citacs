import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@citacs/shared"],
  async redirects() {
    return [
      {
        source: "/s",
        destination: "/settings",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
