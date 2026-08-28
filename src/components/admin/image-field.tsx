'use client';

import { ImageUp, Link2, Loader2, X } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';

import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Campo de imagem com duas entradas: arquivo do computador ou endereço colado.
 *
 * As duas convivem de propósito. O envio de arquivo depende do Storage estar
 * configurado; colar um endereço funciona sempre. Se o campo só oferecesse o
 * envio, uma instalação sem as credenciais ficaria sem nenhuma forma de pôr
 * imagem — e é justamente esse o estado de qualquer projeto recém-criado.
 */

/** Um pedido por página: a resposta não muda enquanto a aba estiver aberta. */
let uploadsEnabled: boolean | null = null;
let uploadsProbe: Promise<void> | null = null;
const listeners = new Set<() => void>();

function probeUploads() {
  uploadsProbe ??= fetch('/api/admin/uploads')
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => {
      uploadsEnabled = Boolean(body?.data?.enabled ?? body?.enabled);
    })
    .catch(() => {
      uploadsEnabled = false;
    })
    .finally(() => {
      for (const listener of listeners) listener();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  probeUploads();
  return () => listeners.delete(listener);
}

/**
 * `useSyncExternalStore` em vez de `useEffect` + `setState`: o React Compiler
 * proíbe o segundo, e este é exatamente o caso para o qual o primeiro existe —
 * um valor que vive fora do React e todos os campos da página compartilham.
 */
function useUploadsEnabled(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => uploadsEnabled === true,
    () => false,
  );
}

export function ImageField({
  label,
  value,
  onChange,
  folder,
  hint,
  error,
  className,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Subpasta no bucket: 'noticias', 'clubes', 'competicoes'… */
  folder: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const canUpload = useUploadsEnabled();

  async function send(file: File) {
    setUploading(true);

    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);

    try {
      const response = await fetch('/api/admin/uploads', { method: 'POST', body });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error('Não foi possível enviar', payload?.error ?? `Erro ${response.status}`);
        return;
      }

      const url = payload?.data?.url ?? payload?.url;
      if (typeof url === 'string') {
        onChange(url);
        toast.success('Imagem enviada');
      }
    } catch (cause) {
      toast.error(
        'Não foi possível enviar',
        cause instanceof Error ? cause.message : 'Falha de rede.',
      );
    } finally {
      setUploading(false);
      // Zera o input para que escolher o MESMO arquivo de novo dispare o
      // evento outra vez — sem isso, uma segunda tentativa não faz nada.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <div className="space-y-2">
        {value ? (
          <div className="glass flex items-center gap-3 rounded-xl p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="size-14 shrink-0 rounded-lg bg-surface-2 object-cover"
            />
            <p className="min-w-0 flex-1 truncate text-xs text-muted" title={value}>
              {value}
            </p>
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-loss/15 hover:text-loss"
              aria-label="Remover imagem"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-subtle" />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://…/imagem.jpg"
              className="pl-9"
            />
          </div>

          {canUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void send(file);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  'glass-button flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-fg transition-colors',
                  'hover:border-accent/50 hover:text-accent disabled:opacity-60',
                )}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImageUp className="size-4" />
                )}
                <span className="hidden sm:inline">{uploading ? 'Enviando…' : 'Enviar'}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
