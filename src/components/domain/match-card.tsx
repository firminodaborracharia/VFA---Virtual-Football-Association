import Link from 'next/link';

import { ClubCrest } from '@/components/common/remote-image';
import { Badge, LiveBadge } from '@/components/ui/badge';
import type { MatchRow } from '@/lib/queries';
import { cn, formatDate, formatDateTime, formatTime, MATCH_STATUS_LABELS } from '@/lib/utils';

/** Linha compacta de partida, usada em listas e nas páginas de clube. */
export function MatchRowItem({
  match,
  highlightClubId,
  showCompetition = true,
}: {
  match: MatchRow;
  highlightClubId?: string;
  showCompetition?: boolean;
}) {
  const finished = match.status === 'FINISHED';
  const decided = finished && match.homeScore !== null && match.awayScore !== null;
  const homeWon = decided && match.homeScore! > match.awayScore!;
  const awayWon = decided && match.awayScore! > match.homeScore!;

  return (
    <Link
      href={`/partidas/${match.id}`}
      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <div className="hidden w-24 shrink-0 text-xs text-subtle sm:block">
        {finished ? formatDate(match.kickoffAt) : formatDateTime(match.kickoffAt)}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
        <span
          className={cn(
            'truncate text-right text-sm',
            homeWon ? 'font-bold text-fg' : 'font-medium text-muted',
            highlightClubId === match.homeId && 'text-accent',
          )}
        >
          <span className="hidden sm:inline">{match.homeShort}</span>
          <span className="sm:hidden">{match.homeAbbr}</span>
        </span>
        <ClubCrest
          club={{ name: match.homeName, abbreviation: match.homeAbbr, logoUrl: match.homeLogo }}
          size={26}
        />
      </div>

      <div className="shrink-0 px-1">
        {decided ? (
          <span className="rounded-lg bg-surface-3 px-2.5 py-1 font-mono text-sm font-bold tabular-nums">
            {match.homeScore} <span className="text-subtle">×</span> {match.awayScore}
          </span>
        ) : match.status === 'LIVE' ? (
          <LiveBadge />
        ) : (
          <span className="rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-subtle">
            {formatTime(match.kickoffAt)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <ClubCrest
          club={{ name: match.awayName, abbreviation: match.awayAbbr, logoUrl: match.awayLogo }}
          size={26}
        />
        <span
          className={cn(
            'truncate text-sm',
            awayWon ? 'font-bold text-fg' : 'font-medium text-muted',
            highlightClubId === match.awayId && 'text-accent',
          )}
        >
          <span className="hidden sm:inline">{match.awayShort}</span>
          <span className="sm:hidden">{match.awayAbbr}</span>
        </span>
      </div>

      {showCompetition ? (
        <div className="hidden w-40 shrink-0 truncate text-right text-xs text-subtle lg:block">
          {match.roundName ?? (match.matchday ? `Rodada ${match.matchday}` : match.competitionName)}
        </div>
      ) : null}

      {match.status === 'POSTPONED' || match.status === 'CANCELLED' ? (
        <Badge tone={match.status === 'CANCELLED' ? 'loss' : 'warn'} className="hidden shrink-0 md:inline-flex">
          {MATCH_STATUS_LABELS[match.status]}
        </Badge>
      ) : null}
    </Link>
  );
}

/** Card destacado de partida, usado no hero da home e nos destaques. */
export function MatchCard({ match, label }: { match: MatchRow; label?: string }) {
  const decided =
    match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null;

  return (
    <Link
      href={`/partidas/${match.id}`}
      className="sheen group block rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-pop motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.7rem] font-bold tracking-widest text-subtle uppercase">
          {label ?? match.competitionName}
        </span>
        {match.status === 'LIVE' ? (
          <LiveBadge />
        ) : (
          <span className="shrink-0 text-xs text-subtle">
            {decided ? formatDate(match.kickoffAt) : formatDateTime(match.kickoffAt)}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
          <ClubCrest
            club={{ name: match.homeName, abbreviation: match.homeAbbr, logoUrl: match.homeLogo }}
            size={48}
          />
          <span className="line-clamp-2 text-xs font-semibold text-fg">{match.homeShort}</span>
        </div>

        <div className="shrink-0 text-center">
          {decided ? (
            <div className="font-mono text-3xl leading-none font-black tabular-nums">
              {match.homeScore}
              <span className="mx-1.5 text-subtle">×</span>
              {match.awayScore}
            </div>
          ) : (
            <div className="font-mono text-xl leading-none font-bold text-subtle">
              {formatTime(match.kickoffAt)}
            </div>
          )}
          {match.homePenalties !== null && match.awayPenalties !== null ? (
            <div className="mt-1 text-[0.65rem] text-subtle">
              pênaltis {match.homePenalties}–{match.awayPenalties}
            </div>
          ) : (
            <div className="mt-1.5 text-[0.65rem] tracking-wider text-subtle uppercase">
              {match.roundName ?? (match.matchday ? `Rodada ${match.matchday}` : '')}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
          <ClubCrest
            club={{ name: match.awayName, abbreviation: match.awayAbbr, logoUrl: match.awayLogo }}
            size={48}
          />
          <span className="line-clamp-2 text-xs font-semibold text-fg">{match.awayShort}</span>
        </div>
      </div>
    </Link>
  );
}
