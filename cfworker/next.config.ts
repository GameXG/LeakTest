import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      {
        source: "/claude/status.html",
        destination: "/status",
        permanent: true
      },
      {
        source: "/risk/status.html",
        destination: "/status",
        permanent: true
      },
      {
        source: "/claude/ipv6.html",
        destination: "/risk",
        permanent: true
      },
      {
        source: "/risk/ipv6.html",
        destination: "/risk",
        permanent: true
      },
      {
        source: "/claude/site.html",
        destination: "/routing",
        permanent: true
      },
      {
        source: "/risk/site.html",
        destination: "/routing",
        permanent: true
      },
      {
        source: "/claude/claudecode.html",
        destination: "/risk",
        permanent: true
      },
      {
        source: "/risk/claudecode.html",
        destination: "/risk",
        permanent: true
      },
      {
        source: "/claude",
        destination: "/risk",
        permanent: true
      },
      {
        source: "/claude/:path*",
        destination: "/risk/:path*",
        permanent: true
      }
    ];
  },
  async headers() {
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, proxy-revalidate"
      },
      {
        key: "Pragma",
        value: "no-cache"
      },
      {
        key: "Expires",
        value: "0"
      }
    ];

    return [
      { source: "/", headers: noStoreHeaders },
      { source: "/risk", headers: noStoreHeaders },
      { source: "/risk/:path*", headers: noStoreHeaders },
      { source: "/ip", headers: noStoreHeaders },
      { source: "/ip/:path*", headers: noStoreHeaders },
      { source: "/routing", headers: noStoreHeaders },
      { source: "/routing/:path*", headers: noStoreHeaders },
      { source: "/webrtc", headers: noStoreHeaders },
      { source: "/webrtc/:path*", headers: noStoreHeaders },
      { source: "/status", headers: noStoreHeaders },
      { source: "/status/:path*", headers: noStoreHeaders },
      { source: "/quality", headers: noStoreHeaders },
      { source: "/quality/:path*", headers: noStoreHeaders },
      { source: "/claude", headers: noStoreHeaders },
      { source: "/claude/:path*", headers: noStoreHeaders }
    ];
  },
  turbopack: {
    root: currentDir
  }
};

export default nextConfig;
