import { ok, route } from '@/lib/api';
import { publishScheduledNews } from '@/lib/mutations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/publish — publica as notícias agendadas cuja hora chegou.
 *
 * Pode ser chamada por um cron (Vercel Cron, GitHub Actions, cron-job.org).
 * Protegida por `CRON_SECRET` quando a variável estiver definida; sem ela, a
 * rota continua segura porque só muda o status de matérias já escritas e
 * agendadas por um administrador.
 */
export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const header = request.headers.get('authorization');
    if (header !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'Não autorizado.' }, { status: 401 });
    }
  }

  const published = await publishScheduledNews();
  return ok({ published });
});
