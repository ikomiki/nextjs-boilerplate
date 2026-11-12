import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/database",
    "@app/datastore-sqlite",
    "@app/ui-components",
  ],
  agentRules: false,
};

export default nextConfig;
