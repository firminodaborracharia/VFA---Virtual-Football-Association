'use client';

import { CalendarPlus, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ClubCrest } from '@/components/common/remote-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, fromLocalInput, toLocalInput } from '@/lib/client-api';
import { formatDateTime, MATCH_STATUS_LABELS } from '@/lib/utils';

export type AdminMatch = {
  id: string;
  kickoffAt: Date;
  status: keyof typeof MATCH_STATUS_LABELS;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  matchday: number | null;
  venue: string | null;
  competitionId: string;
  competitionName: string;
  roundName: string | null;
  homeId: string;
  homeName: string;
  homeAbbr: string;
  homeLogo: string | null;
  awayId: string;
  awayName: string;
  awayAbbr: string;
  awayLogo: string | null;
};

type Club = { id: string; name: string; abbreviation: string; logoUrl: string | null };
type Competition = { id: string; name: string };
type Player = { id: string; displayName: string; clubId: string | null; shirtNumber: number | null };

type EventDraft = {
  key: string;
  clubId: string;
  playerId: string;
  assistPlayerId: string;
  type: 'GOAL' | 'PENALTY_GOAL' | 'OWN_GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'PENALTY_MISS';
  minute: string;
};

const EVENT_LABELS: Record<EventDraft['type'], string> = {
  GOAL: 'Gol',
  PENALTY_GOAL: 'Gol de pênalti',
  OWN_GOAL: 'Gol contra',
  PENALTY_MISS: 'Pênalti perdido',
  YELLOW_CARD: 'Cartão amarelo',
  RED_CARD: 'Cartão vermelho',
};

export function MatchesManager({
  matches,
  clubs,
  competitions,
  players,
}: {
  matches: AdminMatch[];
  clubs: Club[];
  competitions: Competition[];
  players: Player[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [competitionFilter, setCompetitionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminMatch | null>(null);
  const [scoring, setScoring] = useState<AdminMatch | null>(null);
  const [removing, setRemoving] = useState<AdminMatch | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () =>
      matches.filter((match) => {
        if (competitionFilter && match.competitionId !== competitionFilter) return false;
        if (statusFilter && match.status !== statusFilter) return false;
        return true;
      }),
    [matches, competitionFilter, statusFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={competitionFilter}
          onChange={(event) => setCompetitionFilter(event.target.value)}
          className="w-auto min-w-[12rem]"
        >
          <option value="">Todas as competições</option>
          {competitions.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="w-auto min-w-[10rem]"
        >
          <option value="">Todos os status</option>
          {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <div className="ml-auto">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nova partida
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={matches.length === 0 ? 'Nenhuma partida cadastrada' : 'Nenhuma partida com estes filtros'}
          description={
            matches.length === 0
              ? 'Crie partidas manualmente ou gere o calendário inteiro em Competições.'
              : 'Ajuste os filtros acima.'
          }
          action={
            matches.length === 0 ? (
              <Button onClick={() => setCreating(true)}>
                <CalendarPlus className="size-4" />
                Criar partida
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="table-scroll">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Data</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Confronto</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Placar</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Competição</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((match) => (
                  <tr key={match.id} className="hover:bg-surface-2">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted">
                      {formatDateTime(match.kickoffAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <ClubCrest
                          club={{ name: match.homeName, abbreviation: match.homeAbbr, logoUrl: match.homeLogo }}
                          size={20}
                        />
                        <span className="font-semibold">{match.homeAbbr}</span>
                        <span className="text-subtle">×</span>
                        <ClubCrest
                          club={{ name: match.awayName, abbreviation: match.awayAbbr, logoUrl: match.awayLogo }}
                          size={20}
                        />
                        <span className="font-semibold">{match.awayAbbr}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums">
                      {match.homeScore !== null && match.awayScore !== null
                        ? `${match.homeScore} – ${match.awayScore}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {match.competitionName}
                      {match.roundName ? ` · ${match.roundName}` : ''}
                      {match.matchday ? ` · R${match.matchday}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        tone={
                          match.status === 'FINISHED'
                            ? 'accent'
                            : match.status === 'LIVE'
                              ? 'live'
                              : match.status === 'CANCELLED'
                                ? 'loss'
                                : match.status === 'POSTPONED'
                                  ? 'warn'
                                  : 'neutral'
                        }
                      >
                        {MATCH_STATUS_LABELS[match.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setScoring(match)}
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-accent/10 hover:text-accent"
                          aria-label="Registrar resultado"
                          title="Registrar resultado"
                        >
                          <Target className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(match)}
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(match)}
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

      <CreateMatchModal
        open={creating}
        onClose={() => setCreating(false)}
        clubs={clubs}
        competitions={competitions}
        onSaved={() => {
          setCreating(false);
          router.refresh();
        }}
      />

      <EditMatchModal
        match={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ResultModal
        match={scoring}
        players={players}
        onClose={() => setScoring(null)}
        onSaved={() => {
          setScoring(null);
          router.refresh();
        }}
      />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setSaving(true);
          const result = await api.del(`/api/admin/matches/${removing.id}`);
          setSaving(false);
          if (result.ok) {
            toast.success('Partida removida');
            setRemoving(null);
            router.refresh();
          } else {
            toast.error('Não foi possível remover', result.error);
          }
        }}
        loading={saving}
        title="Excluir partida"
        confirmLabel="Excluir"
        message="A partida, os eventos e as escalações serão apagados, e a tabela será recalculada."
      />
    </div>
  );
}

/* ── Criar partida ─────────────────────────────────────────── */

function CreateMatchModal({
  open,
  onClose,
  clubs,
  competitions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clubs: Club[];
  competitions: Competition[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    competitionId: '',
    homeClubId: '',
    awayClubId: '',
    kickoffAt: toLocalInput(new Date()),
    venue: '',
    matchday: '',
  });

  async function save() {
    setSaving(true);
    setErrors({});

    const result = await api.post('/api/admin/matches', {
      competitionId: form.competitionId,
      homeClubId: form.homeClubId,
      awayClubId: form.awayClubId,
      kickoffAt: fromLocalInput(form.kickoffAt),
      venue: form.venue.trim() || null,
      matchday: form.matchday ? Number(form.matchday) : null,
    });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error('Não foi possível criar a partida', result.error);
      return;
    }

    toast.success('Partida criada');
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova partida"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Criar partida
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Competição" required error={errors.competitionId}>
          <Select
            value={form.competitionId}
            onChange={(event) => setForm({ ...form, competitionId: event.target.value })}
          >
            <option value="">Escolha a competição</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mandante" required error={errors.homeClubId}>
            <Select
              value={form.homeClubId}
              onChange={(event) => setForm({ ...form, homeClubId: event.target.value })}
            >
              <option value="">Escolha o clube</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Visitante" required error={errors.awayClubId}>
            <Select
              value={form.awayClubId}
              onChange={(event) => setForm({ ...form, awayClubId: event.target.value })}
            >
              <option value="">Escolha o clube</option>
              {clubs
                .filter((club) => club.id !== form.homeClubId)
                .map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="Data e hora" required error={errors.kickoffAt}>
            <Input
              type="datetime-local"
              value={form.kickoffAt}
              onChange={(event) => setForm({ ...form, kickoffAt: event.target.value })}
            />
          </Field>

          <Field label="Rodada" error={errors.matchday}>
            <Input
              type="number"
              min={1}
              value={form.matchday}
              onChange={(event) => setForm({ ...form, matchday: event.target.value })}
            />
          </Field>
        </div>

        <Field label="Local" error={errors.venue}>
          <Input
            value={form.venue}
            onChange={(event) => setForm({ ...form, venue: event.target.value })}
            placeholder="Nome do servidor / campo"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ── Editar partida ────────────────────────────────────────── */

function EditMatchModal({
  match,
  onClose,
  onSaved,
}: {
  match: AdminMatch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ kickoffAt: '', venue: '', status: 'SCHEDULED', matchday: '' });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Sincroniza o formulário quando outra partida é aberta.
  if (match && loadedFor !== match.id) {
    setLoadedFor(match.id);
    setForm({
      kickoffAt: toLocalInput(match.kickoffAt),
      venue: match.venue ?? '',
      status: match.status,
      matchday: match.matchday ? String(match.matchday) : '',
    });
  }

  async function save() {
    if (!match) return;
    setSaving(true);

    const result = await api.patch(`/api/admin/matches/${match.id}`, {
      kickoffAt: fromLocalInput(form.kickoffAt),
      venue: form.venue.trim() || null,
      status: form.status,
      matchday: form.matchday ? Number(form.matchday) : null,
    });

    setSaving(false);

    if (result.ok) {
      toast.success('Partida atualizada');
      onSaved();
    } else {
      toast.error('Não foi possível salvar', result.error);
    }
  }

  return (
    <Modal
      open={Boolean(match)}
      onClose={onClose}
      title={match ? `${match.homeAbbr} × ${match.awayAbbr}` : ''}
      description="Alterar o status para agendada, adiada ou cancelada limpa o placar registrado."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data e hora">
          <Input
            type="datetime-local"
            value={form.kickoffAt}
            onChange={(event) => setForm({ ...form, kickoffAt: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rodada">
          <Input
            type="number"
            min={1}
            value={form.matchday}
            onChange={(event) => setForm({ ...form, matchday: event.target.value })}
          />
        </Field>
        <Field label="Local">
          <Input
            value={form.venue}
            onChange={(event) => setForm({ ...form, venue: event.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ── Registrar resultado ───────────────────────────────────── */

function ResultModal({
  match,
  players,
  onClose,
  onSaved,
}: {
  match: AdminMatch | null;
  players: Player[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState('0');
  const [awayScore, setAwayScore] = useState('0');
  const [usePenalties, setUsePenalties] = useState(false);
  const [homePenalties, setHomePenalties] = useState('0');
  const [awayPenalties, setAwayPenalties] = useState('0');
  const [events, setEvents] = useState<EventDraft[]>([]);
  const [lineup, setLineup] = useState<Record<string, boolean>>({});

  if (match && loadedFor !== match.id) {
    setLoadedFor(match.id);
    setHomeScore(String(match.homeScore ?? 0));
    setAwayScore(String(match.awayScore ?? 0));
    setUsePenalties(match.homePenalties !== null);
    setHomePenalties(String(match.homePenalties ?? 0));
    setAwayPenalties(String(match.awayPenalties ?? 0));
    setEvents([]);
    // Por padrão todo o elenco dos dois clubes entra como escalado: é o caso
    // mais comum num 3v3 e o admin só desmarca quem não jogou.
    const squad = players.filter(
      (player) => player.clubId === match.homeId || player.clubId === match.awayId,
    );
    setLineup(Object.fromEntries(squad.map((player) => [player.id, true])));
  }

  const homeSquad = players.filter((player) => player.clubId === match?.homeId);
  const awaySquad = players.filter((player) => player.clubId === match?.awayId);

  function addEvent(clubId: string) {
    setEvents((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        clubId,
        playerId: '',
        assistPlayerId: '',
        type: 'GOAL',
        minute: '',
      },
    ]);
  }

  function updateEvent(key: string, patch: Partial<EventDraft>) {
    setEvents((current) =>
      current.map((event) => (event.key === key ? { ...event, ...patch } : event)),
    );
  }

  async function save() {
    if (!match) return;

    // Aviso, não bloqueio: o placar pode ter gols sem autor registrado.
    const goalEvents = events.filter(
      (event) => event.type === 'GOAL' || event.type === 'PENALTY_GOAL',
    ).length;
    const totalGoals = Number(homeScore) + Number(awayScore);

    setSaving(true);

    const result = await api.post(`/api/admin/matches/${match.id}/result`, {
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      homePenalties: usePenalties ? Number(homePenalties) : null,
      awayPenalties: usePenalties ? Number(awayPenalties) : null,
      status: 'FINISHED',
      events: events
        .filter((event) => event.playerId || event.type === 'OWN_GOAL')
        .map((event) => ({
          clubId: event.clubId,
          playerId: event.playerId || null,
          assistPlayerId: event.assistPlayerId || null,
          type: event.type,
          minute: event.minute ? Number(event.minute) : null,
          detail: null,
        })),
      appearances: Object.entries(lineup)
        .filter(([, included]) => included)
        .map(([playerId]) => {
          const player = players.find((item) => item.id === playerId);
          return {
            playerId,
            clubId: player?.clubId ?? '',
            minutes: 0,
            started: true,
          };
        })
        .filter((appearance) => appearance.clubId),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error('Não foi possível salvar o resultado', result.error);
      return;
    }

    if (goalEvents < totalGoals) {
      toast.toast({
        title: 'Resultado salvo',
        description: `${totalGoals - goalEvents} gol(s) do placar não têm autor registrado — a artilharia não vai contá-los.`,
        tone: 'warning',
      });
    } else {
      toast.success('Resultado salvo', 'Tabela e estatísticas foram recalculadas.');
    }

    onSaved();
  }

  if (!match) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Resultado · ${match.homeName} × ${match.awayName}`}
      description="Ao salvar, a tabela, as estatísticas individuais e o chaveamento são recalculados automaticamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar resultado
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Placar */}
        <div className="flex items-center justify-center gap-4 rounded-2xl bg-surface-2 p-5">
          <div className="flex flex-1 flex-col items-center gap-2">
            <ClubCrest
              club={{ name: match.homeName, abbreviation: match.homeAbbr, logoUrl: match.homeLogo }}
              size={40}
            />
            <span className="text-xs font-semibold">{match.homeAbbr}</span>
            <Input
              type="number"
              min={0}
              value={homeScore}
              onChange={(event) => setHomeScore(event.target.value)}
              className="w-16 text-center font-mono text-lg font-bold"
              aria-label={`Gols do ${match.homeName}`}
            />
          </div>

          <span className="font-mono text-xl text-subtle">×</span>

          <div className="flex flex-1 flex-col items-center gap-2">
            <ClubCrest
              club={{ name: match.awayName, abbreviation: match.awayAbbr, logoUrl: match.awayLogo }}
              size={40}
            />
            <span className="text-xs font-semibold">{match.awayAbbr}</span>
            <Input
              type="number"
              min={0}
              value={awayScore}
              onChange={(event) => setAwayScore(event.target.value)}
              className="w-16 text-center font-mono text-lg font-bold"
              aria-label={`Gols do ${match.awayName}`}
            />
          </div>
        </div>

        <div>
          <Checkbox
            label="Decidido nos pênaltis"
            checked={usePenalties}
            onChange={(event) => setUsePenalties(event.target.checked)}
          />
          {usePenalties ? (
            <div className="mt-3 flex items-center gap-3">
              <Input
                type="number"
                min={0}
                value={homePenalties}
                onChange={(event) => setHomePenalties(event.target.value)}
                className="w-20 text-center"
                aria-label="Pênaltis do mandante"
              />
              <span className="text-subtle">×</span>
              <Input
                type="number"
                min={0}
                value={awayPenalties}
                onChange={(event) => setAwayPenalties(event.target.value)}
                className="w-20 text-center"
                aria-label="Pênaltis do visitante"
              />
            </div>
          ) : null}
        </div>

        {/* Eventos */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Gols, assistências e cartões</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => addEvent(match.homeId)}>
                <Plus className="size-3.5" />
                {match.homeAbbr}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => addEvent(match.awayId)}>
                <Plus className="size-3.5" />
                {match.awayAbbr}
              </Button>
            </div>
          </div>

          {events.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-subtle">
              Nenhum evento adicionado. O placar é salvo do mesmo jeito, mas sem eventos a
              artilharia não é atualizada.
            </p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => {
                const squad = event.clubId === match.homeId ? homeSquad : awaySquad;
                const isGoal = event.type === 'GOAL' || event.type === 'PENALTY_GOAL';

                return (
                  <li
                    key={event.key}
                    className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[7rem_1fr_1fr_4rem_2rem]"
                  >
                    <Select
                      value={event.type}
                      onChange={(e) =>
                        updateEvent(event.key, { type: e.target.value as EventDraft['type'] })
                      }
                      aria-label="Tipo de evento"
                    >
                      {Object.entries(EVENT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>

                    <Select
                      value={event.playerId}
                      onChange={(e) => updateEvent(event.key, { playerId: e.target.value })}
                      aria-label="Jogador"
                    >
                      <option value="">Jogador…</option>
                      {squad.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.shirtNumber ? `${player.shirtNumber} · ` : ''}
                          {player.displayName}
                        </option>
                      ))}
                    </Select>

                    {isGoal ? (
                      <Select
                        value={event.assistPlayerId}
                        onChange={(e) =>
                          updateEvent(event.key, { assistPlayerId: e.target.value })
                        }
                        aria-label="Assistência"
                      >
                        <option value="">Sem assistência</option>
                        {squad
                          .filter((player) => player.id !== event.playerId)
                          .map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.displayName}
                            </option>
                          ))}
                      </Select>
                    ) : (
                      <span className="hidden sm:block" />
                    )}

                    <Input
                      type="number"
                      min={0}
                      max={200}
                      placeholder="min"
                      value={event.minute}
                      onChange={(e) => updateEvent(event.key, { minute: e.target.value })}
                      aria-label="Minuto"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setEvents((current) => current.filter((item) => item.key !== event.key))
                      }
                      className="flex items-center justify-center rounded-lg text-subtle transition-colors hover:text-loss"
                      aria-label="Remover evento"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Escalações */}
        <section>
          <h3 className="mb-3 text-sm font-bold">Quem jogou</h3>
          <p className="mb-3 text-xs text-subtle">
            Só quem está marcado conta jogo, vitória e derrota nas estatísticas individuais.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <LineupColumn
              title={match.homeName}
              squad={homeSquad}
              lineup={lineup}
              onToggle={(id, value) => setLineup((current) => ({ ...current, [id]: value }))}
            />
            <LineupColumn
              title={match.awayName}
              squad={awaySquad}
              lineup={lineup}
              onToggle={(id, value) => setLineup((current) => ({ ...current, [id]: value }))}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

function LineupColumn({
  title,
  squad,
  lineup,
  onToggle,
}: {
  title: string;
  squad: Player[];
  lineup: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 truncate text-xs font-bold tracking-wide text-muted uppercase">{title}</p>
      {squad.length === 0 ? (
        <p className="text-xs text-subtle">Nenhum jogador vinculado a este clube.</p>
      ) : (
        <ul className="space-y-1.5">
          {squad.map((player) => (
            <li key={player.id}>
              <Checkbox
                label={
                  player.shirtNumber
                    ? `${player.shirtNumber} · ${player.displayName}`
                    : player.displayName
                }
                checked={lineup[player.id] ?? false}
                onChange={(event) => onToggle(player.id, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
