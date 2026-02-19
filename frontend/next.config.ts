import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build worker usage low to avoid Windows worker crashes in constrained environments.
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
  },
};

export default nextConfig;
