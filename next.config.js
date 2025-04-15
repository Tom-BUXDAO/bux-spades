/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'cdn.discordapp.com'
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude socket-server directory from the build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [...(config.watchOptions?.ignored || []), '**/socket-server/**'],
    };
    return config;
  },
  // Add any other Next.js config options here
};

module.exports = nextConfig; 