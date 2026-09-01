import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { RankBadge } from '@/components/domain/rank-badge';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, POSITION_LABELS, POSITION_SHORT } from '@/lib/utils';

/* ── Jogador ───────────────────────────────────────────────── */

export type PlayerCardData = {
  slug: string;
  displayName: string;
  shirtNumber: number | null;
  position: keyof typeof POSITION_LABELS;
  overall: number | null;
  robloxUsername: string;
  robloxHeadshotUrl: string | null;
  robloxAvatarUrl: string | null;
  isDemo?: boolean;
  clubSlug: string | null;
  clubName: string | null;
  clubAbbreviation: string | null;
  clubLogo: string | null;
  nationFlag: string | null;
  nationName: string | null;
};

export function PlayerCard({ player }: { player: PlayerCardData }) {
  return (
    <Link
      href={`/jogadores/${player.slug}`}
      className="sheen group relative flex flex-col rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop motion-reduce:hover:translate-y-0"
    >
      {player.shirtNumber ? (
        <span className="absolute top-3 right-4 font-mono text-3xl leading-none font-black text-surface-3 transition-colors group-hover:text-accent/20">
          {player.shirtNumber}
        </span>
      ) : null}

      <div className="flex items-center gap-3">
        <PlayerAvatar player={player} size={52} className="ring-2 ring-line" />
        <div className="min-w-0">
          <h3 className="truncate font-bold text-fg transition-colors group-hover:text-accent">
            {player.displayName}
          </h3>
          <p className="truncate text-xs text-subtle">@{player.robloxUsername}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {/* O rank vem primeiro: é o dado que a VFA usa para comparar jogadores,
            e por isso ganha a posição de leitura mais forte da fileira. */}
        <RankBadge overall={player.overall} size="sm" showOverall />
        <Badge tone="accent">{POSITION_SHORT[player.position]}</Badge>
        {player.nationFlag ? (
          <Badge title={player.nationName ?? undefined}>
            <span aria-hidden="true">{player.nationFlag}</span>
            {player.nationName}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
        {player.clubSlug ? (
          <>
            <ClubCrest
              club={{
                name: player.clubName ?? '',
                abbreviation: player.clubAbbreviation,
                logoUrl: player.clubLogo,
              }}
              size={20}
            />
            <span className="truncate text-xs font-semibold text-muted">{player.clubName}</span>
          </>
        ) : (
          <span className="text-xs text-subtle">Sem clube</span>
        )}
      </div>
    </Link>
  );
}

/* ── Clube ─────────────────────────────────────────────────── */

export type ClubCardData = {
  slug: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string;
  ownerName: string | null;
  leagueName: string;
  leagueAccent: string | null;
  nationFlag: string | null;
};

export function ClubCard({
  club,
  position,
  points,
}: {
  club: ClubCardData;
  position?: number;
  points?: number;
}) {
  return (
    <Link
      href={`/clubes/${club.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop motion-reduce:hover:translate-y-0"
    >
      {/* Faixa com a cor do clube, que dá identidade a cada card. */}
      <div
        className="h-1.5 w-full transition-all duration-300 group-hover:h-2"
        style={{ backgroundColor: club.primaryColor }}
      />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <ClubCrest club={club} size={48} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-fg transition-colors group-hover:text-accent">
              {club.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-subtle">
              {club.nationFlag ? <span className="mr-1">{club.nationFlag}</span> : null}
              {club.leagueName}
            </p>
          </div>
          {typeof position === 'number' && position > 0 ? (
            <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-center">
              <span className="block font-mono text-sm leading-none font-bold">{position}º</span>
              {typeof points === 'number' ? (
                <span className="mt-0.5 block text-[0.6rem] text-subtle">{points} pts</span>
              ) : null}
            </span>
          ) : null}
        </div>

        {club.ownerName ? (
          <p className="mt-4 truncate border-t border-line pt-3 text-xs text-muted">
            Dono: <span className="font-semibold text-fg">{club.ownerName}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/* ── Notícia ───────────────────────────────────────────────── */

export type NewsCardData = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export function NewsCard({
  article,
  featured = false,
}: {
  article: NewsCardData;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/noticias/${article.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:border-accent/40 hover:shadow-pop',
        featured && 'md:flex-row',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-surface-2',
          featured ? 'aspect-[16/10] md:aspect-auto md:w-1/2' : 'aspect-[16/9]',
        )}
      >
        {article.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3">
            <span className="text-4xl font-black text-line-strong">VFA</span>
          </div>
        )}
        {article.categoryName ? (
          <span
            className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-black uppercase"
            style={{ backgroundColor: article.categoryColor ?? '#e5e7eb' }}
          >
            {article.categoryName}
          </span>
        ) : null}
      </div>

      <div className={cn('flex flex-1 flex-col p-5', featured && 'md:justify-center md:p-7')}>
        <h3
          className={cn(
            'font-bold leading-snug text-fg transition-colors group-hover:text-accent',
            featured ? 'text-xl md:text-2xl' : 'line-clamp-2 text-base',
          )}
        >
          {article.title}
        </h3>
        {article.subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{article.subtitle}</p>
        ) : article.excerpt ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{article.excerpt}</p>
        ) : null}
        <p className="mt-4 text-xs text-subtle">{formatDate(article.publishedAt)}</p>
      </div>
    </Link>
  );
}

/* ── Aviso de dados de demonstração ────────────────────────── */

/** Item 33 do escopo: o seed precisa ficar claramente identificado. */
export function DemoNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-accent-warm/30 bg-accent-warm/5 px-4 py-3 text-sm',
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 text-accent-warm" aria-hidden="true">
        ⚠
      </span>
      <p className="text-muted">
        <strong className="text-accent-warm">Dados de demonstração.</strong> Este conteúdo foi
        gerado automaticamente para você ver o site preenchido. Remova com{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">npm run db:reset</code>{' '}
        antes de cadastrar os dados reais da VFA.
      </p>
    </div>
  );
}
