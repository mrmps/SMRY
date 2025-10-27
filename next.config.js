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
      ],
    },
  }

module.exports = nextConfig
