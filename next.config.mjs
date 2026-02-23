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
    // Reduce memory usage during webpack builds
    webpackMemoryOptimizations: true,
    // Disable preloading entries to reduce memory usage
    preloadEntriesOnStart: false,
  },
  // Disable in-memory cache to reduce memory usage
  cacheMaxMemorySize: 0,
  // Use memory-only webpack cache (not filesystem) to prevent cache accumulation
  webpack: (config, { dev }) => {
    if (config.cache && !dev) {
      config.cache = Object.freeze({
        type: "memory",
      });
    }
    return config;
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
      {
        protocol: "https",
        hostname: "icons.duckduckgo.com",
      },
    ],
  },
  transpilePackages: ["shiki"],
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "undici", "node-fetch"],

  // Security headers to prevent clickjacking and other attacks
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Redirect auth routes to pricing page (sign-in modal is there)
  async redirects() {
    return [
      {
        source: "/sign-in",
        destination: "/pricing",
        permanent: false,
      },
      {
        source: "/sign-up",
        destination: "/pricing",
        permanent: false,
      },
    ];
  },

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
