import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    /**
     * Nenhum host remoto é liberado, de propósito.
     *
     * Quando um host entra em `remotePatterns`, o navegador passa a pedir
     * `/_next/image?url=…` e é o servidor do site que baixa a imagem lá fora.
     * Numa página com dezenas de avatares isso vira dezenas de downloads que o
     * servidor precisa concluir antes de a requisição fechar — e se o CDN de
     * origem estiver lento, a aba fica carregando indefinidamente.
     *
     * Escudos e avatares têm no máximo 160 pixels: o ganho do otimizador não
     * paga esse risco. Todas as imagens remotas são servidas direto do CDN com
     * `loading="lazy"` — ver src/components/common/remote-image.tsx. Isso ainda
     * evita, de quebra, transformar o otimizador num proxy aberto de imagens,
     * já que logos e capas são URLs digitadas livremente no painel.
     */
    remotePatterns: [],
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
