import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader, type HeaderUser } from '@/components/layout/site-header';
import { ToastProvider } from '@/components/ui/toast';
import { getSession } from '@/lib/rbac';
import { brandToCssVars, getSettings } from '@/lib/settings';

import './globals.css';

/**
 * A tipografia usa a pilha nativa do sistema de propósito: zero requisição de
 * rede para fontes, primeira pintura mais rápida e nenhuma dependência externa
 * no build. Para trocar por uma fonte do Google, importe de `next/font/google`
 * aqui e aponte `--font-display` para a variável dela — é o único lugar que
 * precisa mudar (ver README).
 */
const FONT_STACK =
  "'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/**
 * Endereço público do site, à prova de variável mal preenchida.
 *
 * `process.env.X ?? padrão` NÃO cobre o caso mais comum em deploy: a variável
 * existe, mas com valor vazio. `??` só age em `undefined` e `null`, então a
 * string vazia passa direto e `new URL('')` derruba o build inteiro — foi
 * exatamente o que aconteceu na primeira tentativa de subir para a Vercel.
 *
 * Aqui a regra é outra: só aceita um endereço que realmente seja uma URL. Erro
 * de digitação (`vfa.vercel.app` sem `https://`) também cai no padrão, em vez
 * de quebrar a geração de metadados.
 */
function siteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (raw) {
    try {
      return new URL(raw);
    } catch {
      console.warn(
        `[VFA] NEXT_PUBLIC_SITE_URL não é uma URL válida ("${raw}"). ` +
          'Use o endereço completo, com https://. Seguindo com localhost.',
      );
    }
  }

  return new URL('http://localhost:3000');
}

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSettings();

  return {
    title: {
      default: `${site.name} — ${site.fullName}`,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    metadataBase: siteUrl(),
    openGraph: {
      title: `${site.name} — ${site.fullName}`,
      description: site.description,
      type: 'website',
      locale: 'pt_BR',
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#040807',
  width: 'device-width',
  initialScale: 1,
};

/**
 * O layout raiz envolve TODAS as páginas, inclusive as públicas, então nada
 * aqui pode lançar nem pendurar. `getSession()` já garante as duas coisas —
 * erro vira "deslogado", lentidão tem teto de tempo — e ainda compartilha a
 * leitura com as guardas de rota via `cache()` do React, em vez de consultar
 * o banco de novo em cada camada.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [session, settings] = await Promise.all([getSession(), getSettings()]);

  const user: HeaderUser = session?.user
    ? {
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        role: session.user.role,
        discordUsername: session.user.discordUsername,
      }
    : null;

  // A paleta configurada no painel entra como CSS variables no <html>,
  // sobrepondo os padrões de globals.css sem recompilar nada.
  const cssVars = {
    ...brandToCssVars(settings.brand),
    '--font-display': FONT_STACK,
  } as React.CSSProperties;

  return (
    <html lang="pt-BR" className="h-full antialiased" style={cssVars} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <SiteHeader user={user} siteName={settings.site.name} logoUrl={settings.site.logoUrl} />

          <main className="flex-1">{children}</main>

          <SiteFooter
            siteName={settings.site.name}
            fullName={settings.site.fullName}
            discordUrl={settings.site.discordInviteUrl}
          />
        </ToastProvider>
      </body>
    </html>
  );
}
