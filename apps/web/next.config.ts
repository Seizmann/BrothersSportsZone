import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // R2 public bucket — hostname comes from NEXT_PUBLIC_R2_PUBLIC_URL.
    // r2.dev dev URLs look like pub-<hash>.r2.dev; custom domains are allowed
    // as an escaped pattern so switching to one needs no code change.
    remotePatterns: [{ protocol: "https", hostname: "**.r2.dev" }],
  },
};

export default nextConfig;
