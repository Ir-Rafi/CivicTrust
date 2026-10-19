import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Phone testing (dev only): ngrok HTTPS tunnels, and phones on the same home/office network
  // (private IPv4 ranges, so the dev machine's changing IP needs no edit).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "192.168.*.*", "10.*.*.*"],
  experimental: {
    // citizen photos are resized in the browser to ~0.5 MB; leave headroom
    serverActions: { bodySizeLimit: "4mb" },
    // A warm build cache once shipped the old stylesheet with new markup (unstyled pages).
    // Builds take seconds, so always build CSS fresh, locally and on Vercel.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
