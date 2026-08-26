'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ClubCrest } from '@/components/common/remote-image';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/field';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';

export type AdminClub = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  ownerName: string | null;
  captainId: string | null;
  stadium: string | null;
  leagueId: string;
  leagueName: string;
  nationId: string | null;
};

type Option = { id: string; name: string };

type FormState = {
  name: string;
  shortName: string;
  abbreviation: string;
  leagueId: string;
  nationId: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  ownerName: string;
  captainId: string;
  stadium: string;
};

const EMPTY: FormState = {
  name: '',
  shortName: '',
  abbreviation: '',
  leagueId: '',
  nationId: '',
  logoUrl: '',
  primaryColor: '#e5e7eb',
  secondaryColor: '#0b0f17',
  ownerName: '',
  captainId: '',
  stadium: '',
};

export function ClubsManager({
  clubs,
  leagues,
  nations,
  squads,
}: {
  clubs: AdminClub[];
  leagues: Option[];
  nations: (Option & { flagEmoji: string })[];
  /** Elenco de cada clube, para escolher o capitão sem outra requisição. */
  squads: Record<string, { id: string; displayName: string }[]>;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<AdminClub | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AdminClub | null>(null);

  function openCreate() {
    setForm({ ...EMPTY, leagueId: leagues[0]?.id ?? '' });
    setErrors({});
    setEditing(null);
    setCreating(true);
  }

  function openEdit(club: AdminClub) {
    setForm({
      name: club.name,
      shortName: club.shortName,
      abbreviation: club.abbreviation,
      leagueId: club.leagueId,
      nationId: club.nationId ?? '',
      logoUrl: club.logoUrl ?? '',
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      ownerName: club.ownerName ?? '',
      captainId: club.captainId ?? '',
      stadium: club.stadium ?? '',
    });
    setErrors({});
    setCreating(false);
    setEditing(club);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setErrors({});
  }

  async function save() {
    setSaving(true);
    setErrors({});

    const payload = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || form.name.trim(),
      abbreviation: form.abbreviation.trim().toUpperCase(),
      leagueId: form.leagueId,
      nationId: form.nationId || null,
      logoUrl: form.logoUrl.trim() || null,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      ownerName: form.ownerName.trim() || null,
      captainId: form.captainId || null,
      stadium: form.stadium.trim() || null,
    };

    const result = editing
      ? await api.patch(`/api/admin/clubs/${editing.id}`, payload)
      : await api.post('/api/admin/clubs', payload);

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error('Não foi possível salvar', result.error);
      return;
    }

    toast.success(editing ? 'Clube atualizado' : 'Clube cadastrado');
    close();
    router.refresh();
  }

  async function remove() {
    if (!removing) return;
    setSaving(true);
    const result = await api.del(`/api/admin/clubs/${removing.id}`);
    setSaving(false);

    if (result.ok) {
      toast.success('Clube removido');
      setRemoving(null);
      router.refresh();
    } else {
      // O backend recusa apagar clube com partidas: a mensagem explica por quê.
      toast.error('Não foi possível remover', result.error);
    }
  }

  const squad = editing ? (squads[editing.id] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo clube
        </Button>
      </div>

      {clubs.length === 0 ? (
        <EmptyState
          title="Nenhum clube cadastrado"
          description="Cadastre os clubes antes de criar partidas e competições."
          action={<Button onClick={openCreate}>Cadastrar clube</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="table-scroll">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Clube</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Liga</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Dono</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Elenco</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clubs.map((club) => (
                  <tr key={club.id} className="hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <ClubCrest club={club} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{club.name}</p>
                          <p className="text-xs text-subtle">{club.abbreviation}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{club.leagueName}</td>
                    <td className="px-3 py-2.5 text-muted">{club.ownerName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">
                      {squads[club.id]?.length ?? 0}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(club)}
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(club)}
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-loss/10 hover:text-loss"
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={close}
        title={editing ? `Editar ${editing.name}` : 'Novo clube'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? 'Salvar alterações' : 'Cadastrar clube'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="VFA Futebol Clube"
              />
            </Field>
            <Field label="Nome curto" error={errors.shortName} hint="Usado em tabelas e placares.">
              <Input
                value={form.shortName}
                onChange={(event) => setForm({ ...form, shortName: event.target.value })}
                placeholder="VFA FC"
              />
            </Field>
            <Field label="Sigla" required error={errors.abbreviation} hint="2 ou 3 letras.">
              <Input
                value={form.abbreviation}
                maxLength={3}
                onChange={(event) =>
                  setForm({ ...form, abbreviation: event.target.value.toUpperCase() })
                }
                placeholder="VFA"
              />
            </Field>
            <Field label="Liga" required error={errors.leagueId}>
              <Select
                value={form.leagueId}
                onChange={(event) => setForm({ ...form, leagueId: event.target.value })}
              >
                <option value="">Escolha a liga</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="País" error={errors.nationId}>
              <Select
                value={form.nationId}
                onChange={(event) => setForm({ ...form, nationId: event.target.value })}
              >
                <option value="">Não informado</option>
                {nations.map((nation) => (
                  <option key={nation.id} value={nation.id}>
                    {nation.flagEmoji} {nation.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dono" error={errors.ownerName}>
              <Input
                value={form.ownerName}
                onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                placeholder="Nome do dono no Discord"
              />
            </Field>
          </div>

          <Field
            label="URL do escudo"
            error={errors.logoUrl}
            hint="Link direto para a imagem (PNG ou SVG). Deixe vazio para usar a sigla."
          >
            <Input
              value={form.logoUrl}
              onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
              placeholder="https://…/escudo.png"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cor principal" error={errors.primaryColor}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) => setForm({ ...form, primaryColor: event.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-surface-2"
                  aria-label="Cor principal"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(event) => setForm({ ...form, primaryColor: event.target.value })}
                />
              </div>
            </Field>
            <Field label="Cor secundária" error={errors.secondaryColor}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(event) => setForm({ ...form, secondaryColor: event.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-surface-2"
                  aria-label="Cor secundária"
                />
                <Input
                  value={form.secondaryColor}
                  onChange={(event) => setForm({ ...form, secondaryColor: event.target.value })}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estádio / local" error={errors.stadium}>
              <Input
                value={form.stadium}
                onChange={(event) => setForm({ ...form, stadium: event.target.value })}
              />
            </Field>

            {editing ? (
              <Field
                label="Capitão"
                error={errors.captainId}
                hint="Só jogadores do elenco atual aparecem aqui."
              >
                <Select
                  value={form.captainId}
                  onChange={(event) => setForm({ ...form, captainId: event.target.value })}
                >
                  <option value="">Sem capitão</option>
                  {squad.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={saving}
        title="Excluir clube"
        confirmLabel="Excluir"
        message={
          <>
            Isto apaga <strong className="text-fg">{removing?.name}</strong>. Clubes com partidas
            registradas não podem ser excluídos, para não destruir o histórico da liga.
          </>
        }
      />
    </div>
  );
}
