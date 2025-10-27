/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Workaround for Next.js 15.5 Html import error in error pages
  // This prevents static generation of error pages which causes the build to fail
  output: 'standalone',
}

module.exports = nextConfig
