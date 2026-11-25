import type { NextConfig } from 'next';

const immutableish = 'public, max-age=604800, stale-while-revalidate=86400';

const nextConfig: NextConfig = {
  // A package-lock.json exists in the user's home directory; pin the workspace root.
  turbopack: { root: process.cwd() },
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // ~12 KB of CSS in total: inline it to remove four render-blocking requests (mostly first-time visitors).
    inlineCss: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 82],
    imageSizes: [32, 64, 128, 256, 384, 480],
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560],
  },
  async headers() {
    return [
      { source: '/models/:path*', headers: [{ key: 'Cache-Control', value: immutableish }] },
      { source: '/animations/:path*', headers: [{ key: 'Cache-Control', value: immutableish }] },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: immutableish }] },
      { source: '/basis/:path*', headers: [{ key: 'Cache-Control', value: immutableish }] },
    ];
  },
};

export default nextConfig;
