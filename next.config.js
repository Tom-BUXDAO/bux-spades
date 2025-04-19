/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com'
      }
    ]
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