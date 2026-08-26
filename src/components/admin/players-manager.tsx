'use client';

import { ArrowLeftRight, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PlayerAvatar } from '@/components/common/remote-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';
import { POSITION_LABELS, POSITION_SHORT } from '@/lib/utils';

export type AdminPlayer = {
  id: string;
  slug: string;
  displayName: string;
  robloxUsername: string;
  robloxUserId: string | null;
  robloxHeadshotUrl: string | null;
  robloxAvatarUrl: string | null;
  robloxSyncError: string | null;
  robloxSyncedAt: Date | null;
  shirtNumber: number | null;
  position: keyof typeof POSITION_LABELS;
  isActive: boolean;
  nationId: string | null;
  clubId: string | null;
  clubName: string | null;
};

type Option = { id: string; name: string };

type FormState = {
  displayName: string;
  robloxUsername: string;
  nationId: string;
  currentClubId: string;
  shirtNumber: string;
  position: keyof typeof POSITION_LABELS;
  isActive: boolean;
  syncRoblox: boolean;
};

const EMPTY_FORM: FormState = {
  displayName: '',
  robloxUsername: '',
  nationId: '',
  currentClubId: '',
  shirtNumber: '',
  position: 'MIDFIELDER',
  isActive: true,
  syncRoblox: true,
};

export function PlayersManager({
  players,
  clubs,
  nations,
}: {
  players: AdminPlayer[];
  clubs: Option[];
  nations: (Option & { flagEmoji: string })[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState('');
  const [editing, setEditing] = useState<AdminPlayer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AdminPlayer | null>(null);
  const [transferring, setTransferring] = useState<AdminPlayer | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) => {
      if (clubFilter && player.clubId !== clubFilter) return false;
      if (!term) return true;
      return (
        player.displayName.toLowerCase().includes(term) ||
        player.robloxUsername.toLowerCase().includes(term) ||
        (player.clubName ?? '').toLowerCase().includes(term)
      );
    });
  }, [players, search, clubFilter, ]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditing(null);
    setCreating(true);
  }

  function openEdit(player: AdminPlayer) {
    setForm({
      displayName: player.displayName,
      robloxUsername: player.robloxUsername,
      nationId: player.nationId ?? '',
      currentClubId: player.clubId ?? '',
      shirtNumber: player.shirtNumber ? String(player.shirtNumber) : '',
      position: player.position,
      isActive: player.isActive,
      syncRoblox: false,
    });
    setErrors({});
    setCreating(false);
    setEditing(player);
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setErrors({});
  }

  async function save() {
    setSaving(true);
    setErrors({});

    const payload = {
      displayName: form.displayName.trim(),
      robloxUsername: form.robloxUsername.trim(),
      nationId: form.nationId || null,
      currentClubId: form.currentClubId || null,
      shirtNumber: form.shirtNumber ? Number(form.shirtNumber) : null,
      position: form.position,
      isActive: form.isActive,
      syncRoblox: form.syncRoblox,
    };

    const result = editing
      ? await api.patch(`/api/admin/players/${editing.id}`, payload)
      : await api.post<{ robloxStatus: string | null }>('/api/admin/players', payload);

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error(editing ? 'Não foi possível salvar' : 'Não foi possível cadastrar', result.error);
      return;
    }

    // O cadastro funciona mesmo quando a API do Roblox falha — o aviso deixa
    // isso explícito em vez de fingir que deu tudo certo.
    const robloxStatus =
      !editing && result.data && typeof result.data === 'object'
        ? (result.data as { robloxStatus?: string | null }).robloxStatus
        : null;

    if (robloxStatus === 'FAILED') {
      toast.toast({
        title: 'Jogador cadastrado, mas sem dados do Roblox',
        description: 'Use o botão de atualizar para tentar de novo mais tarde.',
        tone: 'warning',
      });
    } else {
      toast.success(editing ? 'Jogador atualizado' : 'Jogador cadastrado');
    }

    closeModal();
    router.refresh();
  }

  async function remove() {
    if (!removing) return;
    setSaving(true);
    const result = await api.del(`/api/admin/players/${removing.id}`);
    setSaving(false);

    if (result.ok) {
      toast.success('Jogador removido');
      setRemoving(null);
      router.refresh();
    } else {
      toast.error('Não foi possível remover', result.error);
    }
  }

  async function syncRoblox(player: AdminPlayer) {
    setBusyId(player.id);
    const result = await api.post<{ status: string; reason?: string }>(
      `/api/admin/players/${player.id}/roblox`,
    );
    setBusyId(null);

    if (result.ok && result.data.status === 'UPDATED') {
      toast.success(`Dados de ${player.displayName} atualizados`);
      router.refresh();
    } else if (result.ok) {
      toast.toast({
        title: 'Nada foi atualizado',
        description: result.data.reason ?? 'A API do Roblox não devolveu dados novos.',
        tone: 'warning',
      });
    } else {
      toast.error('Falha ao sincronizar', result.error);
    }
  }

  async function transfer() {
    if (!transferring) return;
    setSaving(true);

    const result = await api.post(`/api/admin/players/${transferring.id}/transfer`, {
      toClubId: transferTarget || null,
      type: transferTarget ? 'TRANSFER' : 'RELEASE',
    });

    setSaving(false);

    if (result.ok) {
      toast.success('Transferência registrada');
      setTransferring(null);
      setTransferTarget('');
      router.refresh();
    } else {
      toast.error('Não foi possível transferir', result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, username ou clube…"
            className="h-10 w-full rounded-xl border border-line-strong bg-surface-2 pr-3 pl-9 text-sm focus:border-accent/60 focus:outline-none"
          />
        </div>

        <Select
          value={clubFilter}
          onChange={(event) => setClubFilter(event.target.value)}
          className="w-auto min-w-[10rem]"
        >
          <option value="">Todos os clubes</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </Select>

        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo jogador
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={players.length === 0 ? 'Nenhum jogador cadastrado' : 'Nenhum resultado'}
          description={
            players.length === 0
              ? 'Cadastre o primeiro jogador informando o username do Roblox.'
              : 'Ajuste a busca ou o filtro de clube.'
          }
          action={players.length === 0 ? <Button onClick={openCreate}>Cadastrar jogador</Button> : null}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="table-scroll">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Jogador</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Clube</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Pos.</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Nº</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Roblox</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((player) => (
                  <tr key={player.id} className="hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar player={player} size={30} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{player.displayName}</p>
                          <p className="truncate text-xs text-subtle">@{player.robloxUsername}</p>
                        </div>
                        {!player.isActive ? <Badge tone="warn">Inativo</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{player.clubName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-subtle">
                      {POSITION_SHORT[player.position]}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">
                      {player.shirtNumber ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {player.robloxUserId ? (
                        <Badge tone="accent">OK</Badge>
                      ) : player.robloxSyncError ? (
                        <Badge tone="loss" title={player.robloxSyncError}>
                          Falhou
                        </Badge>
                      ) : (
                        <Badge>—</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label="Atualizar dados do Roblox"
                          onClick={() => syncRoblox(player)}
                          loading={busyId === player.id}
                        >
                          <RefreshCw className="size-3.5" />
                        </IconButton>
                        <IconButton
                          label="Transferir"
                          onClick={() => {
                            setTransferring(player);
                            setTransferTarget('');
                          }}
                        >
                          <ArrowLeftRight className="size-3.5" />
                        </IconButton>
                        <IconButton label="Editar" onClick={() => openEdit(player)}>
                          <Pencil className="size-3.5" />
                        </IconButton>
                        <IconButton label="Excluir" danger onClick={() => setRemoving(player)}>
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal de cadastro/edição ── */}
      <Modal
        open={creating || Boolean(editing)}
        onClose={closeModal}
        title={editing ? `Editar ${editing.displayName}` : 'Novo jogador'}
        description="O username do Roblox é usado para buscar avatar, display name e ID na API oficial."
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Salvar alterações' : 'Cadastrar jogador'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome no site" required error={errors.displayName}>
            <Input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Joãozinho"
            />
          </Field>

          <Field
            label="Username do Roblox"
            required
            error={errors.robloxUsername}
            hint="Exatamente como aparece no perfil, sem o @."
          >
            <Input
              value={form.robloxUsername}
              onChange={(event) => setForm({ ...form, robloxUsername: event.target.value })}
              placeholder="jogador123"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clube" error={errors.currentClubId}>
              <Select
                value={form.currentClubId}
                onChange={(event) => setForm({ ...form, currentClubId: event.target.value })}
              >
                <option value="">Sem clube</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Nacionalidade" error={errors.nationId}>
              <Select
                value={form.nationId}
                onChange={(event) => setForm({ ...form, nationId: event.target.value })}
              >
                <option value="">Não informada</option>
                {nations.map((nation) => (
                  <option key={nation.id} value={nation.id}>
                    {nation.flagEmoji} {nation.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Posição" error={errors.position}>
              <Select
                value={form.position}
                onChange={(event) =>
                  setForm({ ...form, position: event.target.value as FormState['position'] })
                }
              >
                {Object.entries(POSITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Número da camisa" error={errors.shirtNumber}>
              <Input
                type="number"
                min={1}
                max={99}
                value={form.shirtNumber}
                onChange={(event) => setForm({ ...form, shirtNumber: event.target.value })}
                placeholder="10"
              />
            </Field>
          </div>

          <div className="space-y-2.5 border-t border-line pt-4">
            <Checkbox
              label="Jogador ativo na liga"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <Checkbox
              label="Buscar dados do Roblox ao salvar"
              checked={form.syncRoblox}
              onChange={(event) => setForm({ ...form, syncRoblox: event.target.checked })}
            />
          </div>
        </div>
      </Modal>

      {/* ── Transferência ── */}
      <Modal
        open={Boolean(transferring)}
        onClose={() => setTransferring(null)}
        title={`Transferir ${transferring?.displayName ?? ''}`}
        description="O clube anterior fica registrado no histórico do jogador. Nada é apagado."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransferring(null)}>
              Cancelar
            </Button>
            <Button onClick={transfer} loading={saving}>
              Registrar transferência
            </Button>
          </>
        }
      >
        <Field label="Novo clube" hint="Deixe em branco para registrar a saída da liga.">
          <Select
            value={transferTarget}
            onChange={(event) => setTransferTarget(event.target.value)}
          >
            <option value="">Sem clube (saída)</option>
            {clubs
              .filter((club) => club.id !== transferring?.clubId)
              .map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={saving}
        title="Excluir jogador"
        confirmLabel="Excluir"
        message={
          <>
            Isto apaga <strong className="text-fg">{removing?.displayName}</strong> e todas as suas
            estatísticas e participações em partidas. A ação não pode ser desfeita.
          </>
        }
      />
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  danger = false,
  loading = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={loading}
      className={
        danger
          ? 'rounded-lg p-2 text-subtle transition-colors hover:bg-loss/10 hover:text-loss disabled:opacity-40'
          : 'rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40'
      }
    >
      {children}
    </button>
  );
}
