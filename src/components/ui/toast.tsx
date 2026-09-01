'use client';

/**
 * Sistema de notificações (toasts) — item 24 do escopo.
 *
 * Provider global montado no layout raiz. Qualquer componente cliente chama
 * `useToast()` e dispara mensagens de sucesso, erro ou aviso.
 */

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (input: { title: string; description?: string; tone?: ToastTone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'border-win/40 text-win',
  error: 'border-loss/40 text-loss',
  warning: 'border-accent-warm/40 text-accent-warm',
  info: 'border-accent/40 text-accent',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'info' }: { title: string; description?: string; tone?: ToastTone }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-3), { id, title, description, tone }]);
      // Erros ficam mais tempo na tela: costumam pedir leitura.
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end"
        role="region"
        aria-live="polite"
        aria-label="Notificações"
      >
        {/*
          Animação em CSS, não em biblioteca.

          Este componente vive no layout raiz, então tudo que ele importa vai
          junto em TODA página do site. O `framer-motion` daqui custava cerca
          de 130 KB de JavaScript no primeiro carregamento — para animar a
          entrada de um aviso que a maioria dos visitantes nunca vê.

          A saída animada foi o que se perdeu: o aviso agora desaparece de uma
          vez em vez de deslizar para fora. É um detalhe de 0,2 segundo, e a
          troca por 130 KB a menos no celular de quem visita é vantajosa.
        */}
        {toasts.map((item) => {
            const Icon = ICONS[item.tone];
            return (
              <div
                key={item.id}
                className={cn(
                  'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface/95 p-3.5 shadow-pop backdrop-blur',
                  TONE_CLASSES[item.tone],
                )}
              >
                <Icon className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-xs break-words text-muted">{item.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label="Fechar notificação"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  }
  return context;
}
