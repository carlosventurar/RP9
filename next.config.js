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
  // La pagina de novedades lee el CHANGELOG.md de la raiz en tiempo de ejecucion del
  // servidor. El rastreo automatico no lo detecta (la ruta se arma con process.cwd()),
  // asi que hay que incluirlo a mano o en el despliegue no existe.
  outputFileTracingIncludes: {
    '/[locale]/novedades': ['./CHANGELOG.md'],
  },
  // Configure for serverless deployment  
  images: {
    unoptimized: true,
  },
  // Optimize build performance
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

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