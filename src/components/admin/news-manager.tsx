'use client';

import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { api, fromLocalInput, toLocalInput } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';

export type AdminNews = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
  isFeatured: boolean;
  publishedAt: Date | null;
  scheduledFor: Date | null;
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

const STATUS_LABELS = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  PUBLISHED: 'Publicada',
} as const;

type FormState = {
  title: string;
  subtitle: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  categoryId: string;
  status: AdminNews['status'];
  isFeatured: boolean;
  scheduledFor: string;
};

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  categoryId: '',
  status: 'DRAFT',
  isFeatured: false,
  scheduledFor: '',
};

export function NewsManager({
  articles,
  categories,
}: {
  articles: AdminNews[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<AdminNews | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<AdminNews | null>(null);

  function openCreate() {
    setForm(EMPTY);
    setErrors({});
    setEditing(null);
    setCreating(true);
  }

  function openEdit(article: AdminNews) {
    setForm({
      title: article.title,
      subtitle: article.subtitle ?? '',
      excerpt: article.excerpt ?? '',
      content: article.content,
      coverImageUrl: article.coverImageUrl ?? '',
      categoryId: article.categoryId ?? '',
      status: article.status,
      isFeatured: article.isFeatured,
      scheduledFor: toLocalInput(article.scheduledFor),
    });
    setErrors({});
    setCreating(false);
    setEditing(article);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setErrors({});
  }

  async function save(overrideStatus?: AdminNews['status']) {
    setSaving(true);
    setErrors({});

    const status = overrideStatus ?? form.status;

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      excerpt: form.excerpt.trim() || null,
      content: form.content,
      coverImageUrl: form.coverImageUrl.trim() || null,
      categoryId: form.categoryId || null,
      status,
      isFeatured: form.isFeatured,
      scheduledFor: status === 'SCHEDULED' ? fromLocalInput(form.scheduledFor) : null,
    };

    const result = editing
      ? await api.patch(`/api/admin/news/${editing.id}`, payload)
      : await api.post('/api/admin/news', payload);

    setSaving(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      toast.error('Não foi possível salvar', result.error);
      return;
    }

    toast.success(
      status === 'PUBLISHED'
        ? 'Notícia publicada'
        : status === 'SCHEDULED'
          ? 'Publicação agendada'
          : 'Rascunho salvo',
    );
    close();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nova notícia
        </Button>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          title="Nenhuma notícia"
          description="Publique a primeira matéria da VFA News."
          action={<Button onClick={openCreate}>Escrever notícia</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="table-scroll">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Título</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Categoria</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 text-left font-semibold">Data</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <p className="truncate font-semibold">{article.title}</p>
                      {article.isFeatured ? (
                        <span className="text-xs text-accent">Manchete principal</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{article.categoryName ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        tone={
                          article.status === 'PUBLISHED'
                            ? 'accent'
                            : article.status === 'SCHEDULED'
                              ? 'warn'
                              : 'neutral'
                        }
                      >
                        {STATUS_LABELS[article.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {article.status === 'SCHEDULED'
                        ? formatDateTime(article.scheduledFor)
                        : formatDateTime(article.publishedAt ?? article.updatedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/noticias/${article.slug}`}
                          target="_blank"
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                          aria-label="Abrir no site"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(article)}
                          className="rounded-lg p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                          aria-label="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(article)}
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
        size="xl"
        title={editing ? 'Editar notícia' : 'Nova notícia'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={() => save('DRAFT')} loading={saving}>
              Salvar rascunho
            </Button>
            <Button onClick={() => save('PUBLISHED')} loading={saving}>
              Publicar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Título" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="VFA FC contrata Joãozinho por temporada recorde"
            />
          </Field>

          <Field label="Subtítulo" error={errors.subtitle}>
            <Input
              value={form.subtitle}
              onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" error={errors.categoryId}>
              <Select
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Imagem de capa (URL)" error={errors.coverImageUrl}>
              <Input
                value={form.coverImageUrl}
                onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })}
                placeholder="https://…/capa.jpg"
              />
            </Field>
          </div>

          <Field
            label="Resumo"
            error={errors.excerpt}
            hint="Aparece nos cards e na busca. Deixe vazio para gerar automaticamente."
          >
            <Textarea
              value={form.excerpt}
              onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
              rows={2}
            />
          </Field>

          <Field label="Conteúdo" required error={errors.content}>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
            />
          </Field>

          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <Field label="Agendar publicação" error={errors.scheduledFor}>
              <Input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scheduledFor: event.target.value,
                    status: event.target.value ? 'SCHEDULED' : form.status,
                  })
                }
              />
            </Field>

            <div className="flex items-end">
              <Checkbox
                label="Destacar como manchete principal"
                checked={form.isFeatured}
                onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
              />
            </div>
          </div>

          {form.scheduledFor ? (
            <p className="rounded-xl border border-accent-warm/40 bg-accent-warm/5 px-3 py-2 text-xs text-accent-warm">
              Ao salvar como agendada, a matéria fica invisível no site até a data escolhida. A
              publicação acontece quando alguém abre o painel ou quando o cron chama
              <code className="mx-1 font-mono">/api/cron/publish</code>.
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          setSaving(true);
          const result = await api.del(`/api/admin/news/${removing.id}`);
          setSaving(false);
          if (result.ok) {
            toast.success('Notícia removida');
            setRemoving(null);
            router.refresh();
          } else {
            toast.error('Não foi possível remover', result.error);
          }
        }}
        loading={saving}
        title="Excluir notícia"
        confirmLabel="Excluir"
        message={`"${removing?.title ?? ''}" será apagada permanentemente.`}
      />
    </div>
  );
}
