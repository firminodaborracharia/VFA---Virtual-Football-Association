'use client';

import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client-api';
import type { Settings } from '@/lib/settings';

const BRAND_FIELDS: { key: keyof Settings['brand']; label: string; hint: string }[] = [
  { key: 'accent', label: 'Cor de destaque', hint: 'Botões, links e números importantes.' },
  { key: 'accentAlt', label: 'Cor de apoio', hint: 'Gradientes e estados ativos.' },
  { key: 'background', label: 'Fundo', hint: 'Cor base do site.' },
  { key: 'surface', label: 'Cards', hint: 'Fundo dos cartões e tabelas.' },
  { key: 'foreground', label: 'Texto', hint: 'Cor do texto principal.' },
  { key: 'border', label: 'Bordas', hint: 'Linhas e divisórias.' },
];

/**
 * Identidade visual e configurações gerais — itens 1 e 34 do escopo.
 * As cores viram CSS variables no <html>, então trocar a paleta da VFA aqui
 * muda o site inteiro sem tocar em código.
 */
export function SettingsManager({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();

  const [brand, setBrand] = useState(settings.brand);
  const [site, setSite] = useState(settings.site);
  const [roblox, setRoblox] = useState(settings.roblox);
  const [audio, setAudio] = useState(settings.audio);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: 'brand' | 'site' | 'roblox' | 'audio', value: unknown) {
    setSaving(key);
    const result = await api.put('/api/admin/settings', { key, value });
    setSaving(null);

    if (result.ok) {
      toast.success('Configurações salvas');
      router.refresh();
    } else {
      toast.error('Não foi possível salvar', result.error);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Identidade visual"
          description="Trocar aqui muda a paleta do site inteiro"
          action={
            <Button size="sm" onClick={() => save('brand', brand)} loading={saving === 'brand'}>
              <Save className="size-3.5" />
              Salvar
            </Button>
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {BRAND_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brand[field.key]}
                  onChange={(event) => setBrand({ ...brand, [field.key]: event.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line-strong bg-surface-2"
                  aria-label={field.label}
                />
                <Input
                  value={brand[field.key]}
                  onChange={(event) => setBrand({ ...brand, [field.key]: event.target.value })}
                />
              </div>
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Dados do site"
          action={
            <Button size="sm" onClick={() => save('site', site)} loading={saving === 'site'}>
              <Save className="size-3.5" />
              Salvar
            </Button>
          }
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Sigla" hint="Aparece no logo e no cabeçalho.">
            <Input value={site.name} onChange={(event) => setSite({ ...site, name: event.target.value })} />
          </Field>
          <Field label="Nome completo">
            <Input
              value={site.fullName}
              onChange={(event) => setSite({ ...site, fullName: event.target.value })}
            />
          </Field>
          <Field label="Frase padrão" className="sm:col-span-2">
            <Input
              value={site.tagline}
              onChange={(event) => setSite({ ...site, tagline: event.target.value })}
            />
          </Field>
          <Field label="Descrição (SEO)" className="sm:col-span-2">
            <Input
              value={site.description}
              onChange={(event) => setSite({ ...site, description: event.target.value })}
            />
          </Field>
          <Field label="URL do logo">
            <Input
              value={site.logoUrl ?? ''}
              onChange={(event) => setSite({ ...site, logoUrl: event.target.value || null })}
              placeholder="https://…/logo.png"
            />
          </Field>
          <Field label="Convite do Discord">
            <Input
              value={site.discordInviteUrl ?? ''}
              onChange={(event) =>
                setSite({ ...site, discordInviteUrl: event.target.value || null })
              }
              placeholder="https://discord.gg/…"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Integração com o Roblox"
          description="Cache dos perfis públicos"
          action={
            <Button size="sm" onClick={() => save('roblox', roblox)} loading={saving === 'roblox'}>
              <Save className="size-3.5" />
              Salvar
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          <Checkbox
            label="Consultar a API do Roblox"
            checked={roblox.enabled}
            onChange={(event) => setRoblox({ ...roblox, enabled: event.target.checked })}
          />
          <Field
            label="Validade do cache (horas)"
            hint="Quanto tempo os dados de um jogador valem antes de uma nova consulta. Valores altos reduzem o risco de bloqueio por excesso de requisições."
          >
            <Input
              type="number"
              min={1}
              max={720}
              value={roblox.cacheTtlHours}
              onChange={(event) =>
                setRoblox({ ...roblox, cacheTtlHours: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Disco no canto da tela"
          description="Trilha sonora do site"
          action={
            <Button size="sm" onClick={() => save('audio', audio)} loading={saving === 'audio'}>
              <Save className="size-3.5" />
              Salvar
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          <Checkbox
            label="Mostrar o disco"
            checked={audio.enabled}
            onChange={(event) => setAudio({ ...audio, enabled: event.target.checked })}
          />

          <Checkbox
            label="Começar a tocar sozinho"
            checked={audio.autoPlay}
            onChange={(event) => setAudio({ ...audio, autoPlay: event.target.checked })}
          />
          <p className="-mt-2 text-xs text-subtle">
            Os navegadores bloqueiam áudio automático, e não há como um site contornar isso.
            Com esta opção marcada, o site tenta tocar ao abrir e, se for bloqueado, começa no
            primeiro clique, rolagem ou toque em qualquer lugar da página.
          </p>

          <Checkbox
            label="Som ao clicar em botões"
            checked={audio.clickSound}
            onChange={(event) => setAudio({ ...audio, clickSound: event.target.checked })}
          />
          <p className="-mt-2 text-xs text-subtle">
            Um &quot;toc&quot; curto, gerado pelo navegador — não baixa arquivo nenhum. Quem tiver
            &quot;reduzir movimento&quot; ligado no sistema não ouve nada.
          </p>

          <Field
            label="Endereço do áudio"
            hint="Coloque o arquivo em public/audio/ e use /audio/nome.mp3, ou cole uma URL completa. Deixe em branco para o disco ficar só como enfeite, sem som. Use apenas música que você tem direito de publicar — o arquivo fica acessível a qualquer visitante do site."
          >
            <Input
              value={audio.url}
              placeholder="/audio/tema.mp3"
              onChange={(event) => setAudio({ ...audio, url: event.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da faixa">
              <Input
                value={audio.title}
                onChange={(event) => setAudio({ ...audio, title: event.target.value })}
              />
            </Field>
            <Field label="Artista">
              <Input
                value={audio.artist}
                onChange={(event) => setAudio({ ...audio, artist: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}
