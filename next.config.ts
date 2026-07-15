import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compile the workspace shared package (source-only TS) as part of the app.
  transpilePackages: ["@stridequest/shared"],
};

export default nextConfig;
