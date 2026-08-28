import { adminRoute, ok } from '@/lib/api';
import { audit } from '@/lib/mutations';
import { isStorageConfigured, uploadImage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/uploads — o envio de arquivos está disponível?
 *
 * O painel consulta isto para decidir se mostra o botão "Enviar arquivo" ou
 * apenas o campo de endereço. Melhor esconder o botão do que oferecê-lo e
 * responder com erro no clique.
 */
export const GET = adminRoute(async () => ok({ enabled: isStorageConfigured() }));

/**
 * POST /api/admin/uploads — envia uma imagem e devolve o endereço público.
 *
 * `adminRoute` já barra quem não é administrador. Isso importa mais aqui do
 * que numa rota de leitura: uma rota de upload aberta é convite para o
 * primeiro robô que passar encher o seu armazenamento.
 */
export const POST = adminRoute(async (request, { session }) => {
  const form = await request.formData();
  const file = form.get('file');
  const folder = String(form.get('folder') ?? 'geral');

  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { ok: false, error: 'Nenhum arquivo foi enviado.' },
      { status: 400 },
    );
  }

  const result = await uploadImage(file, folder);

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: result.status });
  }

  await audit(session.user.id, 'create', 'upload', result.url, {
    folder,
    type: file.type,
    bytes: file.size,
  });

  return ok({ url: result.url });
});
