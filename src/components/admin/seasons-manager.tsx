'use client';

import { CheckCircle2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ImageField } from '@/components/admin/image-field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';
import { formatDate } from '@/lib/utils';

export type AdminSeason = {
  id: string;
  year: number;
  name: string;
  tagline: string | null;
  bannerUrl: string | null;
  isActive: boolean;
  isArchived: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

export function SeasonsManager({ seasons }: { seasons: AdminSeason[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nextYear = (seasons[0]?.year ?? new Date().getFullYear() - 1) + 1;

  const [form, setForm] = useState({
    year: String(nextYear),
    name: `Temporada ${nextYear}`,
    tagline: '',
    bannerUrl: '',
  });

  async function create() {
    setSaving(true);
    setErrors({});

    const result = await api.post('/api/admin/seasons', {
      year: Number(form.year),
      name: form.name.trim(),
      tagline: form.tagline.trim() || null,
      bannerUrl: form.bannerUrl.trim() || null,
      startDate: null,
      endDate: null,
    });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error('Não foi possível criar', result.error);
      return;
    }

    toast.success('Temporada criada');
    setCreating(false);
    router.refresh();
  }

  async function activate(season: AdminSeason) {
    setSaving(true);
    const result = await api.post(`/api/admin/seasons/${season.id}/activate`);
    setSaving(false);

    if (result.ok) {
      toast.success(`${season.name} agora é a temporada ativa`);
      router.refresh();
    } else {
      toast.error('Não foi possível ativar', result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova temporada
        </Button>
      </div>

      <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        Cada temporada guarda as suas próprias competições, partidas e estatísticas. Ativar uma
        temporada nova <strong className="text-fg">não apaga</strong> as anteriores: o histórico de
        2026 continua acessível quando 2027 começar.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {seasons.map((season) => (
          <Card key={season.id} variant={season.isActive ? 'default' : 'flat'}>
            <CardHeader
              title={season.name}
              description={season.tagline ?? undefined}
              action={
                season.isActive ? (
                  <Badge tone="accent">
                    <CheckCircle2 className="size-3" />
                    Ativa
                  </Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => activate(season)} loading={saving}>
                    Ativar
                  </Button>
                )
              }
            />
            <div className="px-5 py-3 text-xs text-subtle">
              {season.startDate ? `Início ${formatDate(season.startDate)}` : 'Sem data de início'}
              {season.isArchived ? ' · arquivada' : ''}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova temporada"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={create} loading={saving}>
              Criar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ano" required error={errors.year}>
              <Input
                type="number"
                value={form.year}
                onChange={(event) =>
                  setForm({
                    ...form,
                    year: event.target.value,
                    name: `Temporada ${event.target.value}`,
                  })
                }
              />
            </Field>
            <Field label="Nome" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Frase da temporada" hint="Aparece no hero da página inicial.">
            <Input
              value={form.tagline}
              onChange={(event) => setForm({ ...form, tagline: event.target.value })}
              placeholder="Os melhores clubes de futebol 3v3 do Roblox."
            />
          </Field>

          <ImageField
            label="Banner da temporada"
            value={form.bannerUrl}
            onChange={(bannerUrl) => setForm({ ...form, bannerUrl })}
            folder="temporadas"
            error={errors.bannerUrl}
            hint="Aparece atrás do título na página inicial."
          />
        </div>
      </Modal>
    </div>
  );
}
