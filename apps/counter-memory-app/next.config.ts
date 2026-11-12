import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@app/counter",
    "@app/datastore-memory",
    "@app/ui-components",
  ],
};

export default nextConfig;
