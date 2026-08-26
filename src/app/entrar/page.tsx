import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, isDiscordConfigured } from '@/auth';
import { DiscordSignInButton } from '@/components/domain/discord-sign-in-button';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse a VFA com a sua conta do Discord.',
};

const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: 'Não foi possível iniciar o login com o Discord. Tente novamente.',
  OAuthCallback: 'O Discord recusou o retorno do login. Verifique a URL de redirect configurada.',
  OAuthAccountNotLinked: 'Esta conta já está vinculada a outro perfil.',
  AccessDenied: 'Acesso negado. Sua conta pode estar banida da VFA.',
  Configuration: 'O login com Discord não está configurado corretamente neste servidor.',
  Verification: 'O link de verificação expirou.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const settings = await getSettings();

  const next = typeof params.next === 'string' ? params.next : '/';
  if (session?.user && !session.user.isBanned) redirect(next);

  const errorCode = typeof params.error === 'string' ? params.error : null;
  const configured = isDiscordConfigured();

  return (
    <div className="container-vfa flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-line bg-surface p-8 shadow-pop">
          <div className="flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-alt text-lg font-black text-black">
              {settings.site.name.slice(0, 3).toUpperCase()}
            </span>
          </div>

          <h1 className="mt-6 text-center text-2xl font-black tracking-tight">
            Entrar na {settings.site.name}
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            O acesso é feito exclusivamente pelo Discord. Não existe cadastro com e-mail e senha.
          </p>

          {errorCode ? (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 text-sm text-loss">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{AUTH_ERRORS[errorCode] ?? 'Não foi possível concluir o login.'}</p>
            </div>
          ) : null}

          {configured ? (
            <div className="mt-7">
              <DiscordSignInButton redirectTo={next} />
            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-accent-warm/40 bg-accent-warm/5 p-4 text-sm">
              <p className="font-bold text-accent-warm">Login do Discord não configurado</p>
              <p className="mt-2 text-muted">
                O servidor está sem <code className="font-mono text-xs">AUTH_DISCORD_ID</code> e{' '}
                <code className="font-mono text-xs">AUTH_DISCORD_SECRET</code>. Crie uma aplicação
                em{' '}
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  discord.com/developers
                </a>{' '}
                e preencha o arquivo <code className="font-mono text-xs">.env.local</code>. As
                instruções completas estão no <code className="font-mono text-xs">README.md</code>.
              </p>
            </div>
          )}

          <div className="mt-7 flex items-start gap-2.5 rounded-xl bg-surface-2 p-4 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>
              Pedimos apenas o escopo <code className="font-mono">identify</code>: nome de usuário,
              apelido e avatar. Não temos acesso ao seu e-mail, às suas mensagens nem à lista de
              servidores.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-subtle">
          <Link href="/" className="transition-colors hover:text-accent">
            Voltar para a página inicial
          </Link>
        </p>
      </div>
    </div>
  );
}
