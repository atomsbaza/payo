import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve apple-app-site-association with the correct content-type.
  // iOS silently ignores the AASA if it comes back as text/plain.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
        ],
      },
    ]
  },
};

export default nextConfig;
