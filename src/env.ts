/**
 * Validação das variáveis de ambiente.
 *
 * Falha cedo e com mensagem clara em vez de deixar o app quebrar em runtime
 * com "undefined". Nenhum secret é exportado para o bundle do cliente: este
 * módulo só é importado por código de servidor.
 */

import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL é obrigatória. Ex.: postgresql://user:pass@host:5432/vfa'),

  AUTH_SECRET: z
    .string()
    .min(16, 'AUTH_SECRET é obrigatória. Gere com: npx auth secret'),

  AUTH_DISCORD_ID: z.string().min(1, 'AUTH_DISCORD_ID é obrigatória (Discord Developer Portal).'),
  AUTH_DISCORD_SECRET: z
    .string()
    .min(1, 'AUTH_DISCORD_SECRET é obrigatória (Discord Developer Portal).'),

  /**
   * IDs numéricos do Discord que recebem papel ADMIN automaticamente no login.
   * Separados por vírgula. Serve para criar o primeiro administrador — depois
   * disso, a promoção de usuários é feita pelo painel.
   */
  BOOTSTRAP_ADMIN_DISCORD_IDS: z.string().optional().default(''),

  NEXT_PUBLIC_SITE_URL: z.string().url().optional().default('http://localhost:3000'),

  NODE_ENV: z.enum(['development', 'test', 'production']).optional().default('development'),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuração de ambiente inválida.\n${issues}\n\n` +
        'Copie .env.example para .env.local e preencha os valores.',
    );
  }

  cached = parsed.data;
  return cached;
}

/** IDs do Discord que viram administradores automaticamente no primeiro login. */
export function bootstrapAdminIds(): string[] {
  return getEnv()
    .BOOTSTRAP_ADMIN_DISCORD_IDS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
