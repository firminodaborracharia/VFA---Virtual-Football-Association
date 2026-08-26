'use client';

import { Plus, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';

export type ZoneDraft = {
  key: string;
  label: string;
  color: string;
  fromPosition: number;
  toPosition: number;
  targetSlug: string;
  sortOrder: number;
};

/**
 * Zonas de classificação — item 10 do escopo.
 *
 * É aqui que "os 4 primeiros da Liga Brasileira vão para a Libertadores" vira
 * dado. Nada disso está fixo no código: rótulo, cor, intervalo de posições e
 * competição de destino são todos editáveis.
 */
export function ZonesManager({
  leagues,
  competitions,
}: {
  leagues: { id: string; name: string; zones: ZoneDraft[] }[];
  competitions: { slug: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      {leagues.map((league) => (
        <LeagueZones
          key={league.id}
          leagueId={league.id}
          leagueName={league.name}
          initialZones={league.zones}
          competitions={competitions}
        />
      ))}
    </div>
  );
}

function LeagueZones({
  leagueId,
  leagueName,
  initialZones,
  competitions,
}: {
  leagueId: string;
  leagueName: string;
  initialZones: ZoneDraft[];
  competitions: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [zones, setZones] = useState<ZoneDraft[]>(initialZones);
  const [saving, setSaving] = useState(false);

  function update(key: string, patch: Partial<ZoneDraft>) {
    setZones((current) =>
      current.map((zone) => (zone.key === key ? { ...zone, ...patch } : zone)),
    );
  }

  async function save() {
    setSaving(true);
    const result = await api.put(`/api/admin/leagues/${leagueId}/zones`, {
      zones: zones.map((zone, index) => ({
        label: zone.label,
        color: zone.color,
        fromPosition: zone.fromPosition,
        toPosition: zone.toPosition,
        targetSlug: zone.targetSlug || null,
        sortOrder: index,
      })),
    });
    setSaving(false);

    if (result.ok) {
      toast.success(`Zonas da ${leagueName} salvas`);
      router.refresh();
    } else {
      toast.error('Não foi possível salvar', result.error);
    }
  }

  return (
    <Card>
      <CardHeader
        title={leagueName}
        description="Faixas coloridas da tabela de classificação"
        action={
          <Button size="sm" onClick={save} loading={saving}>
            <Save className="size-3.5" />
            Salvar
          </Button>
        }
      />

      <div className="space-y-3 p-5">
        {zones.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma zona configurada. Sem zonas, a tabela aparece sem as faixas coloridas.
          </p>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.key}
              className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_5rem_5rem_1fr_2.5rem]"
            >
              <Field label="Rótulo">
                <Input
                  value={zone.label}
                  onChange={(event) => update(zone.key, { label: event.target.value })}
                  placeholder="Libertadores"
                />
              </Field>

              <Field label="Da posição">
                <Input
                  type="number"
                  min={1}
                  value={zone.fromPosition}
                  onChange={(event) =>
                    update(zone.key, { fromPosition: Number(event.target.value) })
                  }
                />
              </Field>

              <Field label="Até">
                <Input
                  type="number"
                  min={1}
                  value={zone.toPosition}
                  onChange={(event) => update(zone.key, { toPosition: Number(event.target.value) })}
                />
              </Field>

              <Field label="Competição de destino">
                <Select
                  value={zone.targetSlug}
                  onChange={(event) => update(zone.key, { targetSlug: event.target.value })}
                >
                  <option value="">Nenhuma</option>
                  {competitions.map((competition) => (
                    <option key={competition.slug} value={competition.slug}>
                      {competition.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex items-end gap-2">
                <input
                  type="color"
                  value={zone.color}
                  onChange={(event) => update(zone.key, { color: event.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-line-strong bg-surface"
                  aria-label="Cor da zona"
                />
                <button
                  type="button"
                  onClick={() =>
                    setZones((current) => current.filter((item) => item.key !== zone.key))
                  }
                  className="h-10 rounded-lg px-2 text-subtle transition-colors hover:text-loss"
                  aria-label="Remover zona"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setZones((current) => [
              ...current,
              {
                key: crypto.randomUUID(),
                label: '',
                color: '#22c55e',
                fromPosition: current.length > 0 ? Math.max(...current.map((z) => z.toPosition)) + 1 : 1,
                toPosition: current.length > 0 ? Math.max(...current.map((z) => z.toPosition)) + 1 : 4,
                targetSlug: '',
                sortOrder: current.length,
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Adicionar zona
        </Button>
      </div>
    </Card>
  );
}
