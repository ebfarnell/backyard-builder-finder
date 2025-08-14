/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Docker
  output: 'standalone',
  
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '1.0.0',
  },
  
  // Experimental features
  experimental: {
    // Enable app directory
    appDir: true,
    // Server components
    serverComponentsExternalPackages: ['@bbf/shared'],
  },
  
  // Image optimization
  images: {
    domains: [
      'localhost',
      's3.amazonaws.com',
      'via.placeholder.com', // For development
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Redirects
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/search',
        permanent: false,
      },
    ];
  },
  
  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Shared package resolution
    config.externals.push({
      '@bbf/shared': '@bbf/shared',
    });
    
    return config;
  },
  
  // TypeScript configuration
  typescript: {
    // Dangerously allow production builds to complete even if there are type errors
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration
  eslint: {
    // Warning: This allows production builds to complete even if there are ESLint errors
    ignoreDuringBuilds: false,
  },
  
  // Compression
  compress: true,
  
  // Power user features
  poweredByHeader: false,
  
  // Trailing slash
  trailingSlash: false,
};

module.exports = nextConfig;