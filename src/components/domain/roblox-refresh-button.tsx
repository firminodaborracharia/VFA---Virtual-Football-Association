'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Botão "Atualizar dados Roblox" — item 29 do escopo.
 * Só é renderizado para administradores (a página decide isso no servidor) e a
 * rota também exige ADMIN, então esconder o botão é só conveniência visual.
 */
export function RobloxRefreshButton({
  playerId,
  size = 'sm',
}: {
  playerId: string;
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/players/${playerId}/roblox`, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        toast.error('Não foi possível atualizar', payload?.error ?? 'Erro desconhecido.');
        return;
      }

      const status = payload.data?.status;
      if (status === 'UPDATED') {
        toast.success('Dados do Roblox atualizados');
        router.refresh();
      } else if (status === 'SKIPPED') {
        toast.toast({
          title: 'Integração desligada',
          description: payload.data?.reason,
          tone: 'warning',
        });
      } else {
        toast.error('A API do Roblox não respondeu', payload.data?.reason);
      }
    } catch {
      toast.error('Falha de rede', 'Não foi possível falar com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size={size} onClick={refresh} loading={loading}>
      {!loading ? <RefreshCw className="size-3.5" /> : null}
      Atualizar dados Roblox
    </Button>
  );
}
