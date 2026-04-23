import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "fluent-ffmpeg"],
};

export default nextConfig;
