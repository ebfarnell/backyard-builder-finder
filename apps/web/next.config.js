/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output configuration for Netlify
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  
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
  
};

module.exports = nextConfig;