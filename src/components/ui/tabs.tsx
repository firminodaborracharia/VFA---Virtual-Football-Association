'use client';

import { motion } from 'framer-motion';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type TabItem = {
  id: string;
  label: ReactNode;
  content: ReactNode;
  count?: number;
};

/**
 * Abas com indicador que desliza entre os itens (`layoutId` do Framer Motion).
 * Em telas estreitas a régua rola horizontalmente em vez de quebrar linha.
 */
export function Tabs({
  items,
  defaultTab,
  className,
}: {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
}) {
  const groupId = useId();
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const current = items.find((item) => item.id === active) ?? items[0];

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div
        role="tablist"
        className="table-scroll -mx-1 flex gap-1 border-b border-line px-1 pb-px"
      >
        {items.map((item) => {
          const isActive = item.id === current?.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(item.id)}
              className={cn(
                'relative shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                isActive ? 'text-accent' : 'text-muted hover:text-fg',
              )}
            >
              <span className="flex items-center gap-2">
                {item.label}
                {typeof item.count === 'number' ? (
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[0.65rem] text-subtle">
                    {item.count}
                  </span>
                ) : null}
              </span>
              {isActive ? (
                <motion.span
                  layoutId={`tab-indicator-${groupId}`}
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <motion.div
        key={current?.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        role="tabpanel"
        className="pt-5"
      >
        {current?.content}
      </motion.div>
    </div>
  );
}
