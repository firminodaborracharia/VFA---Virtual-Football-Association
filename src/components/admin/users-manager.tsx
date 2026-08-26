'use client';

import { Ban, ShieldCheck, ShieldOff, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';
import { formatDate, initials } from '@/lib/utils';

export type AdminUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  discordUsername: string | null;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  createdAt: Date;
};

export function UsersManager({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function update(user: AdminUser, patch: { role?: 'USER' | 'ADMIN'; isBanned?: boolean }) {
    setBusy(user.id);
    const result = await api.patch(`/api/admin/users/${user.id}`, patch);
    setBusy(null);

    if (result.ok) {
      toast.success('Permissões atualizadas');
      router.refresh();
    } else {
      toast.error('Não foi possível atualizar', result.error);
    }
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="Nenhum usuário ainda"
        description="Os perfis são criados automaticamente quando alguém entra com o Discord."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        Os perfis nascem sozinhos no primeiro login com Discord. Aqui você decide quem é
        administrador. O sistema impede rebaixar a si mesmo e impede deixar a liga sem nenhum
        administrador ativo.
      </p>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="table-scroll">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                <th scope="col" className="px-4 py-3 text-left font-semibold">Usuário</th>
                <th scope="col" className="px-3 py-3 text-left font-semibold">Discord</th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">Cargo</th>
                <th scope="col" className="px-3 py-3 text-left font-semibold">Entrou em</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.image} alt="" className="size-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-subtle">
                          {initials(user.name ?? user.discordUsername ?? '?')}
                        </span>
                      )}
                      <span className="font-semibold">{user.name ?? 'Sem nome'}</span>
                      {user.id === currentUserId ? <Badge>você</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">
                    {user.discordUsername ? `@${user.discordUsername}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {user.isBanned ? (
                      <Badge tone="loss">Banido</Badge>
                    ) : user.role === 'ADMIN' ? (
                      <Badge tone="warn">Administrador</Badge>
                    ) : (
                      <Badge>Torcedor</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {user.role === 'ADMIN' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busy === user.id}
                          onClick={() => update(user, { role: 'USER' })}
                        >
                          <ShieldOff className="size-3.5" />
                          Rebaixar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === user.id}
                          onClick={() => update(user, { role: 'ADMIN' })}
                        >
                          <ShieldCheck className="size-3.5" />
                          Promover
                        </Button>
                      )}

                      {user.isBanned ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busy === user.id}
                          onClick={() => update(user, { isBanned: false })}
                        >
                          <Undo2 className="size-3.5" />
                          Reativar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busy === user.id}
                          onClick={() => update(user, { isBanned: true })}
                        >
                          <Ban className="size-3.5" />
                          Banir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
