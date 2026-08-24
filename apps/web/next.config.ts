import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@shipora/ui", "@shipora/types", "@shipora/code-analyzer"],
  serverExternalPackages: ["@clerk/nextjs"],
};

export default nextConfig;

