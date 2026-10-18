import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // phone testing through an ngrok HTTPS tunnel (dev only)
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app"],
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
