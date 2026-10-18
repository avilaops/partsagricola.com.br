import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@partsagricola/ui",
    "@partsagricola/config",
    "@partsagricola/api-client",
  ],
  eslint: { ignoreDuringBuilds: true },
};
export default config;
