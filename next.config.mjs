/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [],
  },
  // Allow external images dari sumber RSS berita
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fxsstatic.com' },
      { protocol: 'https', hostname: '**.fxstreet.com' },
      { protocol: 'https', hostname: '**.forexlive.com' },
      { protocol: 'https', hostname: '**.investing.com' },
      { protocol: 'https', hostname: '**.marketwatch.com' },
      { protocol: 'https', hostname: '**.reuters.com' },
      { protocol: 'https', hostname: '**.yahoo.com' },
      { protocol: 'https', hostname: '**.yimg.com' },
      { protocol: 'https', hostname: '**.wsj.net' },
      { protocol: 'https', hostname: '**.blogspot.com' },
      { protocol: 'https', hostname: '**.wp.com' },
      { protocol: 'https', hostname: '**.wordpress.com' },
      { protocol: 'https', hostname: '**' }, // fallback untuk OG images dari domain lain
    ],
    // Nonaktifkan optimization untuk external images (bypass semua domain)
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
    ];
  },
};

export default nextConfig;
