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
  // Optimize build performance
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  // Disable static generation for pages to prevent prerender errors
  experimental: {
    missingSuspenseWithCSRBailout: false,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Use app directory 
  appDir: true,
  // Optimize webpack
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      }
    }
    return config
  },
}

module.exports = withNextIntl(nextConfig)