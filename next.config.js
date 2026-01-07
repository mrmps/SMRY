const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // Memory leak mitigations for Next.js 16 + standalone mode
    // See: https://github.com/vercel/next.js/issues/85914
    experimental: {
      instrumentationHook: true,
      // Limit server action body size to prevent memory pressure
      serverActions: {
        bodySizeLimit: '2mb',
      },
    },
    images: {
      minimumCacheTTL: 2678400, // 31 days
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'www.google.com',
        },
        {
          protocol: 'https',
          hostname: 'img.logo.dev',
        },
        {
          protocol: 'https',
          hostname: 'unavatar.io',
        },
      ],
    },
    serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],
  }

module.exports = withNextIntl(nextConfig)
