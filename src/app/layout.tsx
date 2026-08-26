import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader, type HeaderUser } from '@/components/layout/site-header';
import { ToastProvider } from '@/components/ui/toast';
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

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSettings();

  return {
    title: {
      default: `${site.name} — ${site.fullName}`,
      template: `%s · ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
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
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [session, settings] = await Promise.all([auth(), getSettings()]);

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
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
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
