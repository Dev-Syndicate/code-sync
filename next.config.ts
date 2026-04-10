import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin Turbopack's resolution root to this project so it stops walking up
  // to d:\PROJECTS\HACK-A-THON looking for node_modules. Without this,
  // Tailwind v4 + Turbopack fail to resolve 'tailwindcss' on first request.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
