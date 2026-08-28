import 'server-only';

/**
 * Envio de imagens para o Supabase Storage.
 *
 * ── Por que não salvar na pasta do projeto ──
 *
 * O caminho intuitivo seria gravar em `public/uploads/`. Não funciona em
 * produção, e o motivo não é detalhe: o sistema de arquivos da Vercel é
 * somente leitura durante a execução, e mesmo onde a escrita é permitida cada
 * novo deploy sobe uma máquina limpa. A imagem enviada hoje sumiria no próximo
 * `git push`. Arquivo enviado por usuário precisa de um lugar que sobreviva ao
 * deploy — e você já tem um, incluído no mesmo projeto Supabase do banco.
 *
 * ── Por que a chave de serviço, e por que só no servidor ──
 *
 * Escrever num bucket exige a `service_role`, que ignora todas as regras de
 * acesso do Supabase. Ela dá poder total sobre o projeto inteiro, banco
 * incluído. Por isso este arquivo é `server-only`: se algum componente de
 * cliente tentar importá-lo, o build QUEBRA em vez de embutir a chave no
 * JavaScript que vai para o navegador. A proteção é do compilador, não da
 * disciplina de quem escreve o código.
 */

/** Tipos aceitos. Lista fechada: nada de SVG, que pode carregar script. */
const ALLOWED = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
]);

const MAX_BYTES = 5 * 1024 * 1024;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'vfa-public';

export type StorageConfig = {
  baseUrl: string;
  serviceKey: string;
};

/**
 * Lê a configuração do Storage, derivando o endereço da própria `DATABASE_URL`
 * quando possível — o host do pooler carrega a referência do projeto, então na
 * prática só a chave precisa ser informada à mão.
 */
export function storageConfig(): StorageConfig | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) return null;

  const explicit = process.env.SUPABASE_URL?.trim();
  const baseUrl = explicit || deriveSupabaseUrl();
  if (!baseUrl) return null;

  return { baseUrl: baseUrl.replace(/\/+$/, ''), serviceKey };
}

/**
 * `postgres://postgres.abcdefgh:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
 * carrega a referência do projeto no nome de usuário (`postgres.abcdefgh`).
 * Daí sai `https://abcdefgh.supabase.co`, e o administrador não precisa
 * preencher uma variável que o sistema já consegue deduzir.
 */
function deriveSupabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (!url.hostname.includes('supabase')) return null;

    const [, projectRef] = decodeURIComponent(url.username).split('.');
    if (!projectRef) return null;

    return `https://${projectRef}.supabase.co`;
  } catch {
    return null;
  }
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null;
}

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number };

export async function uploadImage(file: File, folder: string): Promise<UploadResult> {
  const config = storageConfig();

  if (!config) {
    return {
      ok: false,
      status: 501,
      error:
        'O envio de arquivos ainda não está configurado. Falta a variável ' +
        'SUPABASE_SERVICE_ROLE_KEY. Por enquanto, cole o endereço de uma imagem.',
    };
  }

  const extension = ALLOWED.get(file.type);
  if (!extension) {
    return {
      ok: false,
      status: 415,
      error: 'Formato não aceito. Use PNG, JPG, WEBP, GIF ou AVIF.',
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Arquivo grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é 5 MB.`,
    };
  }

  /**
   * O nome é gerado, nunca aproveitado do arquivo enviado.
   *
   * Nome vindo do usuário traz três problemas de uma vez: caracteres que
   * quebram a URL, colisão entre dois envios do mesmo `foto.png`, e a chance
   * de alguém tentar `../` para escapar da pasta. Um nome aleatório com a
   * extensão derivada do TIPO declarado — não da extensão do arquivo — elimina
   * os três.
   */
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'geral';
  const objectPath = `${safeFolder}/${crypto.randomUUID()}.${extension}`;

  const endpoint = `${config.baseUrl}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': file.type,
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: await file.arrayBuffer(),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');

      if (response.status === 404 || detail.includes('Bucket not found')) {
        return {
          ok: false,
          status: 500,
          error:
            `O bucket "${STORAGE_BUCKET}" não existe no Supabase. ` +
            'Crie em Storage → New bucket, marcando "Public bucket".',
        };
      }

      return {
        ok: false,
        status: 502,
        error: `O Supabase recusou o envio (${response.status}). ${detail.slice(0, 200)}`,
      };
    }

    return {
      ok: true,
      url: `${config.baseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: `Falha de rede ao enviar: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
