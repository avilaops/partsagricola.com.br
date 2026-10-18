import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@partsagricola/ui", "@partsagricola/config"],
  eslint: { ignoreDuringBuilds: true },
};
export default config;
