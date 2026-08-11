import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Netlify Next runtime
  images: {
    unoptimized: true,
  },
}

export default nextConfig
