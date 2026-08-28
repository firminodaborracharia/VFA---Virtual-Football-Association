/**
 * Configurações globais editáveis pelo administrador (tabela `app_settings`).
 *
 * Item 34 do escopo: identidade, regras padrão e parâmetros operacionais ficam
 * no banco, não no código. Toda chave tem um valor padrão, então o site sobe
 * mesmo com a tabela vazia.
 */

import { inArray } from 'drizzle-orm';
import { cache } from 'react';
import { z } from 'zod';

import { db, withTimeout } from '@/db';
import { appSettings } from '@/db/schema';

/* ── Identidade visual ────────────────────────────────────────
   As cores viram CSS variables no <html>, então trocar a paleta da VFA é
   editar aqui (ou pelo painel) — nenhum componente tem cor fixa.          */

export const brandSchema = z.object({
  /** Cor de destaque principal. */
  accent: z.string().default('#00e08f'),
  /** Cor de apoio, usada em gradientes e estados ativos. */
  accentAlt: z.string().default('#1e6bff'),
  /** Fundo base do modo escuro. */
  background: z.string().default('#070b12'),
  /** Fundo dos cards. */
  surface: z.string().default('#0e141f'),
  /** Cor de texto principal. */
  foreground: z.string().default('#e9eef7'),
  /** Cor da borda padrão. */
  border: z.string().default('#1c2534'),
});

export const siteSchema = z.object({
  name: z.string().default('VFA'),
  fullName: z.string().default('Virtual Football Association'),
  tagline: z.string().default('Os melhores clubes de futebol 3v3 do Roblox.'),
  logoUrl: z.string().nullable().default(null),
  description: z
    .string()
    .default('Site oficial da VFA — resultados, tabelas, estatísticas e notícias.'),
  discordInviteUrl: z.string().nullable().default(null),
});

export const robloxSchema = z.object({
  /** Horas antes de considerar o cache do perfil Roblox vencido. */
  cacheTtlHours: z.number().int().min(1).max(720).default(24),
  /** Desliga completamente as chamadas à API do Roblox. */
  enabled: z.boolean().default(true),
});

export const SETTING_SCHEMAS = {
  brand: brandSchema,
  site: siteSchema,
  roblox: robloxSchema,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type Brand = z.infer<typeof brandSchema>;
export type SiteSettings = z.infer<typeof siteSchema>;
export type RobloxSettings = z.infer<typeof robloxSchema>;

export type Settings = {
  brand: Brand;
  site: SiteSettings;
  roblox: RobloxSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  brand: brandSchema.parse({}),
  site: siteSchema.parse({}),
  roblox: robloxSchema.parse({}),
};

async function loadSettings(): Promise<Settings> {
  const keys = Object.keys(SETTING_SCHEMAS) as SettingKey[];
  const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));

  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as SettingKey;
    const schema = SETTING_SCHEMAS[key];
    if (!schema) continue;
    const parsed = schema.safeParse(row.value);
    if (parsed.success) {
      // A união de schemas impede a inferência automática aqui; o safeParse
      // acima já garante que o formato bate com a chave.
      (result as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return result;
}

/**
 * Lê todas as configurações. Se o banco estiver indisponível ou vazio, devolve
 * os padrões — a home nunca fica em branco por causa de configuração.
 *
 * Envolvido em `cache()` do React: numa mesma requisição, `generateMetadata`,
 * o layout raiz e a página chamam isto de forma independente. Sem a memoização
 * eram três idas ao banco para o mesmo dado, em toda navegação.
 *
 * O `withTimeout` é a rede de segurança: esta função roda no layout raiz, que
 * embrulha TODAS as páginas. Um banco lento aqui pendurava o site inteiro sem
 * dar nenhuma mensagem.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  // Sem banco configurado (build limpo, primeira execução) o site sobe com a
  // identidade padrão em vez de esperar um timeout de conexão.
  if (!process.env.DATABASE_URL) return DEFAULT_SETTINGS;

  try {
    return await withTimeout(loadSettings(), DEFAULT_SETTINGS, {
      ms: 8_000,
      label: 'Leitura das configurações do site',
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<z.infer<(typeof SETTING_SCHEMAS)[K]>> {
  const all = await getSettings();
  return all[key] as z.infer<(typeof SETTING_SCHEMAS)[K]>;
}

export async function updateSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): Promise<z.infer<(typeof SETTING_SCHEMAS)[K]>> {
  const schema = SETTING_SCHEMAS[key];
  const parsed = schema.parse(value);

  await db
    .insert(appSettings)
    .values({ key, value: parsed })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: parsed } });

  return parsed as z.infer<(typeof SETTING_SCHEMAS)[K]>;
}

/**
 * Converte a paleta em CSS variables aplicadas no <html>.
 * É o único ponto do sistema que traduz configuração em cor.
 */
export function brandToCssVars(brand: Brand): Record<string, string> {
  return {
    '--vfa-accent': brand.accent,
    '--vfa-accent-alt': brand.accentAlt,
    '--vfa-bg': brand.background,
    '--vfa-surface': brand.surface,
    '--vfa-fg': brand.foreground,
    '--vfa-border': brand.border,
  };
}
