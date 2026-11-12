import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/datastore-indexed-db",
    "@app/ui-components",
  ],
  agentRules: false,
};

export default nextConfig;
