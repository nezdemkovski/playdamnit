import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace files from the monorepo root so workspace packages end up in the standalone build
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
