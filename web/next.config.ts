import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/Node-only packages must not be bundled into server components.
  serverExternalPackages: ["mongoose", "bcrypt"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
