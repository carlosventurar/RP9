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
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // Configure for serverless deployment
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig