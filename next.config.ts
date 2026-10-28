import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Cached HTML cannot resume development-only React debug data over a live socket.
  experimental: { reactDebugChannel: false },
  async headers() {
    return [{ source: "/offline-worker.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] }];
  },
  redirects() {
    return ["granskning", "underlag"].map((path) => ({
      source: `/admin/${path}/:path*`, destination: "/admin/fakturaunderlag/:path*", permanent: true,
    }));
  },
};

export default nextConfig;
