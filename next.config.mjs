/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com'
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net'
      },
      {
        protocol: 'https',
        hostname: 'instagram.com'
      },
      {
        protocol: 'https',
        hostname: '**.instagram.com'
      }
    ]
  }
};

export default nextConfig;
