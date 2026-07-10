import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app: the monorepo has a sibling
  // package-lock.json (root scripts) that Turbopack would otherwise infer.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // Native/Node-only packages must not be bundled into server components.
  serverExternalPackages: ["mongoose", "bcrypt"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Seed catalog images
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
