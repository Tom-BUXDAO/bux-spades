/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    domains: ['bux-spades-buxdaos-projects.vercel.app'],
  },
  webpack: (config, { isServer }) => {
    // Exclude socket-server directory from the build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: Array.isArray(config.watchOptions?.ignored) 
        ? [...config.watchOptions.ignored, '**/socket-server/**']
        : ['**/socket-server/**']
    };
    return config;
  },
};

module.exports = nextConfig; 