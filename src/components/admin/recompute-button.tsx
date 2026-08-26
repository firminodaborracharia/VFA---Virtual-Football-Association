'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';

/**
 * Recalcula tabelas e estatísticas da temporada inteira.
 * Botão de manutenção: normalmente o recálculo já acontece sozinho a cada
 * resultado registrado.
 */
export function RecomputeButton({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const result = await api.post(`/api/admin/recompute?seasonId=${seasonId}`);
    setLoading(false);

    if (result.ok) {
      toast.success('Tabelas e estatísticas recalculadas');
      router.refresh();
    } else {
      toast.error('Não foi possível recalcular', result.error);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={run} loading={loading}>
      {!loading ? <RefreshCw className="size-3.5" /> : null}
      Recalcular tudo
    </Button>
  );
}
