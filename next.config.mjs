import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silences the "multiple lockfiles" workspace-root warning when the
  // project lives inside a folder that also contains a stray lockfile.
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  // R3F / three.js ship as ESM — transpile to be safe under the App Router.
  transpilePackages: ["three"],
  // msedge-tts uses raw WebSocket (ws) — webpack bundling breaks ws's
  // native buffer masking, so keep these as runtime node_modules requires.
  serverExternalPackages: ["msedge-tts", "ws", "bufferutil", "utf-8-validate"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
