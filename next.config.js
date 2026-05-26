/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow server-side use of pdf-parse (node-only)
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

module.exports = nextConfig;
