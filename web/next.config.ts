import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:5001";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app: the monorepo has a sibling
  // package-lock.json (root scripts) that Turbopack would otherwise infer.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Seed catalog images
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Dev: proxy /api to the Express server so the browser stays same-origin
  // (the JWT cookie needs no cross-site config locally). In production the
  // frontend talks to the API's absolute URL via NEXT_PUBLIC_API_URL and
  // this rewrite is unused.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
