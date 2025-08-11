const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds for production deploy
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds for production deploy
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['sharp'],
  // Configure for serverless deployment
  images: {
    unoptimized: true,
  },
}

module.exports = withNextIntl(nextConfig)