import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    /**
     * Só o CDN do Roblox passa pelo otimizador de imagens.
     *
     * Logos de clube e capas de notícia são URLs digitadas pelo administrador e
     * podem apontar para qualquer host; liberar `**` aqui transformaria o
     * otimizador do Next num proxy aberto de imagens. Esses casos usam <img>
     * comum com `loading="lazy"` — ver src/components/common/remote-image.tsx.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'tr.rbxcdn.com' },
      { protocol: 'https', hostname: '**.rbxcdn.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
