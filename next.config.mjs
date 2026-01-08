import createNextIntlPlugin from "next-intl/plugin";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Fix Turbopack workspace root detection issue
  turbopack: {
    root: __dirname,
  },
  // Memory leak mitigations for Next.js 16 + standalone mode
  // See: https://github.com/vercel/next.js/issues/85914
  experimental: {
    // Limit server action body size to prevent memory pressure
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    minimumCacheTTL: 2678400, // 31 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
      },
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
    ],
  },
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],

  // Proxy /api/* requests to Elysia server running on port 3001
  // This allows both servers to run in the same container with Railway
  // exposing only port 3000 (Next.js) publicly
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiUrl}/health`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
