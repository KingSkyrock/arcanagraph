import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-lobby",
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
