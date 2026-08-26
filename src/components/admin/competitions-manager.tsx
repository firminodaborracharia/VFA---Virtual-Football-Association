'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users, Wand2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox, Field, FieldGroup, Input, Select } from '@/components/ui/field';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, fromLocalInput, toLocalInput } from '@/lib/client-api';
import {
  CONFIG_PRESETS,
  KNOCKOUT_TIEBREAK_LABELS,
  KNOCKOUT_TIEBREAKS,
  SEEDING_RULE_LABELS,
  SEEDING_RULES,
  TIEBREAKER_LABELS,
  TIEBREAKERS,
  type CompetitionConfig,
  type Tiebreaker,
} from '@/lib/engine/config';
import { COMPETITION_TYPE_LABELS } from '@/lib/utils';

export type AdminCompetition = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  type: keyof typeof COMPETITION_TYPE_LABELS;
  status: 'DRAFT' | 'UPCOMING' | 'IN_PROGRESS' | 'FINISHED';
  leagueId: string | null;
  parentSlug: string | null;
  accent: string | null;
  sortOrder: number;
  config: CompetitionConfig;
  teamIds: string[];
  championName: string | null;
};

type Option = { id: string; name: string };

const STATUS_LABELS = {
  DRAFT: 'Rascunho',
  UPCOMING: 'Em breve',
  IN_PROGRESS: 'Em andamento',
  FINISHED: 'Encerrada',
} as const;

export function CompetitionsManager({
  competitions,
  leagues,
  clubs,
  seasonId,
}: {
  competitions: AdminCompetition[];
  leagues: Option[];
  clubs: (Option & { leagueId: string })[];
  seasonId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<AdminCompetition | null>(null);
  const [creating, setCreating] = useState(false);
  const [teamsFor, setTeamsFor] = useState<AdminCompetition | null>(null);
  const [generateFor, setGenerateFor] = useState<AdminCompetition | null>(null);
  const [removing, setRemoving] = useState<AdminCompetition | null>(null);
  const [saving, setSaving] = useState(false);

  if (!seasonId) {
    return (
      <EmptyState
        title="Nenhuma temporada ativa"
        description="Crie e ative uma temporada antes de configurar competições."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova competição
        </Button>
      </div>

      {competitions.length === 0 ? (
        <EmptyState
          title="Nenhuma competição nesta temporada"
          description="Crie as ligas nacionais, os mata-matas e os torneios continentais."
          action={<Button onClick={() => setCreating(true)}>Criar competição</Button>}
        />
      ) : (
        <div className="space-y-3">
          {competitions.map((competition) => (
            <div
              key={competition.id}
              className="rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{competition.name}</h3>
                    <Badge>{COMPETITION_TYPE_LABELS[competition.type]}</Badge>
                    <Badge tone={competition.status === 'IN_PROGRESS' ? 'accent' : 'neutral'}>
                      {STATUS_LABELS[competition.status]}
                    </Badge>
                    {competition.championName ? (
                      <Badge tone="warn">Campeão: {competition.championName}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs text-subtle">
                    <code className="font-mono">{competition.slug}</code> ·{' '}
                    {competition.teamIds.length} clube(s) · vitória{' '}
                    {competition.config.points.win} pt ·{' '}
                    {competition.config.knockout.enabled
                      ? `mata-mata com ${competition.config.knockout.qualifiers} classificados e ${competition.config.knockout.byes} bye(s)`
                      : `${competition.config.rounds} turno(s)`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setTeamsFor(competition)}>
                    <Users className="size-3.5" />
                    Participantes
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setGenerateFor(competition)}>
                    <Wand2 className="size-3.5" />
                    Gerar confrontos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(competition)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(competition)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CompetitionForm
        open={creating || Boolean(editing)}
        competition={editing}
        leagues={leagues}
        seasonId={seasonId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />

      <TeamsModal
        competition={teamsFor}
        clubs={clubs}
        onClose={() => setTeamsFor(null)}
        onSaved={() => {
          setTeamsFor(null);
          router.refresh();
        }}
      />

      <GenerateModal
        competition={generateFor}
        onClose={() => setGenerateFor(null)}
        onSaved={() => {
          setGenerateFor(null);
          router.refresh();
        }}
      />

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setSaving(true);
          const result = await api.del(`/api/admin/competitions/${removing.id}`);
          setSaving(false);
          if (result.ok) {
            toast.success('Competição removida');
            setRemoving(null);
            router.refresh();
          } else {
            toast.error('Não foi possível remover', result.error);
          }
        }}
        loading={saving}
        title="Excluir competição"
        confirmLabel="Excluir"
        message="Todas as partidas, fases e estatísticas desta competição serão apagadas."
      />
    </div>
  );
}

/* ── Formulário de competição (inclui as regras) ───────────── */

function CompetitionForm({
  open,
  competition,
  leagues,
  seasonId,
  onClose,
  onSaved,
}: {
  open: boolean;
  competition: AdminCompetition | null;
  leagues: Option[];
  seasonId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    shortName: '',
    type: 'LEAGUE' as AdminCompetition['type'],
    status: 'DRAFT' as AdminCompetition['status'],
    leagueId: '',
    parentSlug: '',
    accent: '#00e08f',
    sortOrder: '0',
  });

  const [config, setConfig] = useState<CompetitionConfig>(CONFIG_PRESETS.LEAGUE);

  const key = competition?.id ?? (open ? 'new' : null);
  if (key && loadedFor !== key) {
    setLoadedFor(key);
    if (competition) {
      setForm({
        name: competition.name,
        shortName: competition.shortName ?? '',
        type: competition.type,
        status: competition.status,
        leagueId: competition.leagueId ?? '',
        parentSlug: competition.parentSlug ?? '',
        accent: competition.accent ?? '#00e08f',
        sortOrder: String(competition.sortOrder),
      });
      setConfig(competition.config);
    } else {
      setForm({
        name: '',
        shortName: '',
        type: 'LEAGUE',
        status: 'DRAFT',
        leagueId: '',
        parentSlug: '',
        accent: '#00e08f',
        sortOrder: '0',
      });
      setConfig(CONFIG_PRESETS.LEAGUE);
    }
    setErrors({});
  }

  function applyPreset(type: AdminCompetition['type']) {
    setForm((current) => ({ ...current, type }));
    setConfig(CONFIG_PRESETS[type]);
  }

  function moveTiebreaker(index: number, direction: -1 | 1) {
    const next = [...config.tiebreakers];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setConfig({ ...config, tiebreakers: next });
  }

  async function save() {
    setSaving(true);
    setErrors({});

    const payload = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      type: form.type,
      status: form.status,
      seasonId,
      leagueId: form.leagueId || null,
      parentSlug: form.parentSlug.trim() || null,
      accent: form.accent,
      sortOrder: Number(form.sortOrder) || 0,
      config,
    };

    const result = competition
      ? await api.patch(`/api/admin/competitions/${competition.id}`, payload)
      : await api.post('/api/admin/competitions', payload);

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error('Não foi possível salvar', result.error);
      return;
    }

    toast.success(competition ? 'Competição atualizada' : 'Competição criada');
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={competition ? `Editar ${competition.name}` : 'Nova competição'}
      description="Todas as regras abaixo ficam no banco. Mudar a pontuação ou o desempate recalcula a tabela na hora."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {competition ? 'Salvar' : 'Criar competição'}
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <FieldGroup title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="VFA Liga Brasileira"
              />
            </Field>
            <Field label="Nome curto" error={errors.shortName}>
              <Input
                value={form.shortName}
                onChange={(event) => setForm({ ...form, shortName: event.target.value })}
                placeholder="Brasileirão"
              />
            </Field>
            <Field
              label="Tipo"
              error={errors.type}
              hint="Trocar o tipo carrega as regras padrão dele."
            >
              <Select
                value={form.type}
                onChange={(event) => applyPreset(event.target.value as AdminCompetition['type'])}
              >
                {Object.entries(COMPETITION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" error={errors.status}>
              <Select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as AdminCompetition['status'] })
                }
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Liga" error={errors.leagueId} hint="Só para competições nacionais.">
              <Select
                value={form.leagueId}
                onChange={(event) => setForm({ ...form, leagueId: event.target.value })}
              >
                <option value="">Nenhuma (competição continental)</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Competição pai"
              error={errors.parentSlug}
              hint="Slug de onde vêm os classificados. Para a Intercontinental, use dois separados por vírgula."
            >
              <Input
                value={form.parentSlug}
                onChange={(event) => setForm({ ...form, parentSlug: event.target.value })}
                placeholder="vfa-liga-brasileira"
              />
            </Field>
            <Field label="Cor de destaque">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.accent}
                  onChange={(event) => setForm({ ...form, accent: event.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-surface-2"
                  aria-label="Cor de destaque"
                />
                <Input
                  value={form.accent}
                  onChange={(event) => setForm({ ...form, accent: event.target.value })}
                />
              </div>
            </Field>
            <Field label="Ordem de exibição">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup title="Pontuação" description="Quantos pontos vale cada resultado.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Vitória">
              <Input
                type="number"
                value={config.points.win}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    points: { ...config.points, win: Number(event.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Empate">
              <Input
                type="number"
                value={config.points.draw}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    points: { ...config.points, draw: Number(event.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Derrota">
              <Input
                type="number"
                value={config.points.loss}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    points: { ...config.points, loss: Number(event.target.value) },
                  })
                }
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup
          title="Critérios de desempate"
          description="A ordem importa: o primeiro é aplicado primeiro."
        >
          <ul className="space-y-1.5">
            {config.tiebreakers.map((criterion, index) => (
              <li
                key={criterion}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
              >
                <span className="w-5 text-center font-mono text-xs text-subtle">{index + 1}</span>
                <span className="flex-1 text-sm">{TIEBREAKER_LABELS[criterion]}</span>
                <button
                  type="button"
                  onClick={() => moveTiebreaker(index, -1)}
                  disabled={index === 0}
                  className="rounded p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTiebreaker(index, 1)}
                  disabled={index === config.tiebreakers.length - 1}
                  className="rounded p-1 text-subtle transition-colors hover:text-fg disabled:opacity-30"
                  aria-label="Descer"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      tiebreakers: config.tiebreakers.filter((item) => item !== criterion),
                    })
                  }
                  disabled={config.tiebreakers.length <= 1}
                  className="rounded p-1 text-subtle transition-colors hover:text-loss disabled:opacity-30"
                  aria-label="Remover"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <Select
            value=""
            onChange={(event) => {
              const value = event.target.value as Tiebreaker;
              if (!value || config.tiebreakers.includes(value)) return;
              setConfig({ ...config, tiebreakers: [...config.tiebreakers, value] });
            }}
          >
            <option value="">Adicionar critério…</option>
            {TIEBREAKERS.filter((criterion) => !config.tiebreakers.includes(criterion)).map(
              (criterion) => (
                <option key={criterion} value={criterion}>
                  {TIEBREAKER_LABELS[criterion]}
                </option>
              ),
            )}
          </Select>
        </FieldGroup>

        <FieldGroup title="Formato">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clubes participantes" hint="Usado como referência ao gerar a tabela.">
              <Input
                type="number"
                min={2}
                value={config.teamCount}
                onChange={(event) =>
                  setConfig({ ...config, teamCount: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Turnos" hint="1 = turno único, 2 = turno e returno.">
              <Input
                type="number"
                min={1}
                max={4}
                value={config.rounds}
                onChange={(event) => setConfig({ ...config, rounds: Number(event.target.value) })}
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup
          title="Mata-mata"
          description="Com 6 clubes e 2 byes: 1º e 2º vão direto à semifinal; 3º×6º e 4º×5º nas quartas."
        >
          <Checkbox
            label="Esta competição tem fase eliminatória"
            checked={config.knockout.enabled}
            onChange={(event) =>
              setConfig({
                ...config,
                knockout: { ...config.knockout, enabled: event.target.checked },
              })
            }
          />

          {config.knockout.enabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clubes classificados">
                <Input
                  type="number"
                  min={2}
                  value={config.knockout.qualifiers}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: { ...config.knockout, qualifiers: Number(event.target.value) },
                    })
                  }
                />
              </Field>
              <Field label="Byes" hint="Melhores colocados que pulam a primeira fase.">
                <Input
                  type="number"
                  min={0}
                  value={config.knockout.byes}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: { ...config.knockout, byes: Number(event.target.value) },
                    })
                  }
                />
              </Field>
              <Field label="Jogos por confronto">
                <Select
                  value={String(config.knockout.legs)}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: { ...config.knockout, legs: Number(event.target.value) },
                    })
                  }
                >
                  <option value="1">Jogo único</option>
                  <option value="2">Ida e volta</option>
                </Select>
              </Field>
              <Field label="Critério de desempate do confronto">
                <Select
                  value={config.knockout.tiebreak}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: {
                        ...config.knockout,
                        tiebreak: event.target.value as (typeof KNOCKOUT_TIEBREAKS)[number],
                      },
                    })
                  }
                >
                  {KNOCKOUT_TIEBREAKS.map((value) => (
                    <option key={value} value={value}>
                      {KNOCKOUT_TIEBREAK_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Semeadura">
                <Select
                  value={config.knockout.seeding}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: {
                        ...config.knockout,
                        seeding: event.target.value as (typeof SEEDING_RULES)[number],
                      },
                    })
                  }
                >
                  {SEEDING_RULES.map((value) => (
                    <option key={value} value={value}>
                      {SEEDING_RULE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Checkbox
                  label="Disputa de terceiro lugar"
                  checked={config.knockout.thirdPlace}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      knockout: { ...config.knockout, thirdPlace: event.target.checked },
                    })
                  }
                />
              </div>
            </div>
          ) : null}
        </FieldGroup>

        <FieldGroup
          title="Fase de grupos"
          description="Opcional. Com 8 clubes em mata-mata direto, deixe desligada."
        >
          <Checkbox
            label="Esta competição tem fase de grupos"
            checked={config.groupStage.enabled}
            onChange={(event) =>
              setConfig({
                ...config,
                groupStage: { ...config.groupStage, enabled: event.target.checked },
              })
            }
          />

          {config.groupStage.enabled ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Número de grupos">
                <Input
                  type="number"
                  min={1}
                  value={config.groupStage.groups}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      groupStage: { ...config.groupStage, groups: Number(event.target.value) },
                    })
                  }
                />
              </Field>
              <Field label="Avançam por grupo">
                <Input
                  type="number"
                  min={1}
                  value={config.groupStage.advancePerGroup}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      groupStage: {
                        ...config.groupStage,
                        advancePerGroup: Number(event.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Turnos no grupo">
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={config.groupStage.rounds}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      groupStage: { ...config.groupStage, rounds: Number(event.target.value) },
                    })
                  }
                />
              </Field>
            </div>
          ) : null}
        </FieldGroup>
      </div>
    </Modal>
  );
}

/* ── Participantes ─────────────────────────────────────────── */

function TeamsModal({
  competition,
  clubs,
  onClose,
  onSaved,
}: {
  competition: AdminCompetition | null;
  clubs: (Option & { leagueId: string })[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (competition && loadedFor !== competition.id) {
    setLoadedFor(competition.id);
    setSelected(competition.teamIds);
  }

  async function save() {
    if (!competition) return;
    setSaving(true);
    const result = await api.put(`/api/admin/competitions/${competition.id}/teams`, {
      clubIds: selected,
    });
    setSaving(false);

    if (result.ok) {
      toast.success('Participantes atualizados');
      onSaved();
    } else {
      toast.error('Não foi possível salvar', result.error);
    }
  }

  async function autoPopulate() {
    if (!competition) return;
    setSaving(true);
    const result = await api.post<{ added?: number; ready?: boolean; warnings: string[] }>(
      `/api/admin/competitions/${competition.id}/populate`,
    );
    setSaving(false);

    if (!result.ok) {
      toast.error('Não foi possível preencher', result.error);
      return;
    }

    for (const warning of result.data.warnings ?? []) {
      toast.toast({ title: 'Atenção', description: warning, tone: 'warning' });
    }

    toast.success('Participantes definidos pela classificação');
    onSaved();
  }

  const isAutomatic =
    competition?.type === 'CONTINENTAL' || competition?.type === 'INTERCONTINENTAL';

  return (
    <Modal
      open={Boolean(competition)}
      onClose={onClose}
      size="lg"
      title={`Participantes · ${competition?.name ?? ''}`}
      description={
        isAutomatic
          ? 'Você pode preencher automaticamente pelos classificados das ligas, ou escolher os clubes na mão.'
          : 'Escolha os clubes que disputam esta competição.'
      }
      footer={
        <>
          {isAutomatic ? (
            <Button variant="secondary" onClick={autoPopulate} loading={saving}>
              <Wand2 className="size-3.5" />
              Preencher automaticamente
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar ({selected.length})
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {clubs.map((club) => (
          <Checkbox
            key={club.id}
            label={club.name}
            checked={selected.includes(club.id)}
            onChange={(event) =>
              setSelected((current) =>
                event.target.checked
                  ? [...current, club.id]
                  : current.filter((id) => id !== club.id),
              )
            }
          />
        ))}
      </div>
    </Modal>
  );
}

/* ── Geração de confrontos ─────────────────────────────────── */

function GenerateModal({
  competition,
  onClose,
  onSaved,
}: {
  competition: AdminCompetition | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [startAt, setStartAt] = useState(toLocalInput(new Date()));
  const [days, setDays] = useState('7');
  const [replace, setReplace] = useState(false);
  const [venue, setVenue] = useState('');
  const [mode, setMode] = useState<'auto' | 'league' | 'knockout'>('auto');

  async function run() {
    if (!competition) return;
    setSaving(true);

    const query = mode === 'auto' ? '' : `?mode=${mode}`;
    const result = await api.post<{ created: number; removed: number; warnings: string[] }>(
      `/api/admin/competitions/${competition.id}/generate${query}`,
      {
        startAt: fromLocalInput(startAt),
        daysBetweenRounds: Number(days),
        replaceExisting: replace,
        venue: venue.trim() || null,
      },
    );

    setSaving(false);

    if (!result.ok) {
      toast.error('Não foi possível gerar', result.error);
      return;
    }

    for (const warning of result.data.warnings ?? []) {
      toast.toast({ title: 'Atenção', description: warning, tone: 'warning' });
    }

    toast.success(
      `${result.data.created} partida(s) criada(s)`,
      result.data.removed > 0 ? `${result.data.removed} partida(s) antiga(s) removida(s).` : undefined,
    );
    onSaved();
  }

  return (
    <Modal
      open={Boolean(competition)}
      onClose={onClose}
      title={`Gerar confrontos · ${competition?.name ?? ''}`}
      description="A geração respeita a configuração da competição: turnos, classificados, byes e semeadura."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={run} loading={saving}>
            <Wand2 className="size-3.5" />
            Gerar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="O que gerar">
          <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="auto">Automático (segue a configuração)</option>
            <option value="league">Tabela de pontos corridos</option>
            <option value="knockout">Chaveamento do mata-mata</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primeira rodada em">
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </Field>
          <Field label="Dias entre rodadas">
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Local padrão">
          <Input value={venue} onChange={(event) => setVenue(event.target.value)} />
        </Field>

        <Checkbox
          label="Apagar as partidas existentes antes de gerar"
          checked={replace}
          onChange={(event) => setReplace(event.target.checked)}
        />

        {replace ? (
          <p className="rounded-xl border border-accent-warm/40 bg-accent-warm/5 px-3 py-2 text-xs text-accent-warm">
            Isto remove os resultados já registrados desta fase. Use com cuidado.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
