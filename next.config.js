const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
