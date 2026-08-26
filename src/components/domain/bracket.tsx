import Link from 'next/link';

import { ClubCrest } from '@/components/common/remote-image';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate, formatTime } from '@/lib/utils';

export type BracketMatch = {
  id: string;
  bracketSlot: number | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  kickoffAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  home: { id: string; name: string; shortName: string; abbreviation: string; logoUrl: string | null } | null;
  away: { id: string; name: string; shortName: string; abbreviation: string; logoUrl: string | null } | null;
};

export type BracketRound = {
  id: string;
  name: string;
  order: number;
  matches: BracketMatch[];
};

/**
 * Chaveamento visual — itens 9, 11, 12 do escopo.
 *
 * Uma coluna por fase, rolagem horizontal no celular. Cada confronto mostra
 * escudos, nomes, placar, data e destaca o vencedor. Confrontos ainda sem
 * definição aparecem como "A definir" em vez de sumirem da tela — é assim que
 * o torcedor entende que a vaga existe e ainda está em disputa.
 */
export function Bracket({ rounds }: { rounds: BracketRound[] }) {
  if (rounds.length === 0) {
    return (
      <EmptyState
        title="Chaveamento ainda não gerado"
        description="Assim que o administrador definir os classificados e gerar os confrontos, o mata-mata aparece aqui."
      />
    );
  }

  return (
    <div className="table-scroll -mx-4 px-4 pb-2">
      <div className="flex min-w-max gap-4 lg:gap-8">
        {rounds.map((round, roundIndex) => (
          <div
            key={round.id}
            className="flex w-[17rem] shrink-0 flex-col"
            style={{ animation: `vfa-fade-up 0.5s var(--vfa-ease) ${roundIndex * 0.08}s both` }}
          >
            <h3 className="mb-4 text-center text-xs font-bold tracking-[0.2em] text-subtle uppercase">
              {round.name}
            </h3>

            <div className="flex flex-1 flex-col justify-around gap-4">
              {round.matches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-xs text-subtle">
                  Confrontos a definir
                </div>
              ) : (
                round.matches.map((match) => <BracketTie key={match.id} match={match} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketTie({ match }: { match: BracketMatch }) {
  const decided =
    match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null;

  let winner: 'home' | 'away' | null = null;
  if (decided) {
    if (match.homeScore! > match.awayScore!) winner = 'home';
    else if (match.awayScore! > match.homeScore!) winner = 'away';
    else if (match.homePenalties !== null && match.awayPenalties !== null) {
      if (match.homePenalties > match.awayPenalties) winner = 'home';
      else if (match.awayPenalties > match.homePenalties) winner = 'away';
    }
  }

  return (
    <Link
      href={`/partidas/${match.id}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition-all duration-300 hover:border-accent/50 hover:shadow-pop"
    >
      <BracketSide
        club={match.home}
        score={match.homeScore}
        penalties={match.homePenalties}
        isWinner={winner === 'home'}
        dimmed={winner === 'away'}
      />
      <div className="h-px bg-line" />
      <BracketSide
        club={match.away}
        score={match.awayScore}
        penalties={match.awayPenalties}
        isWinner={winner === 'away'}
        dimmed={winner === 'home'}
      />

      <div className="flex items-center justify-between border-t border-line bg-surface-2 px-3 py-1.5 text-[0.65rem] text-subtle">
        <span>{formatDate(match.kickoffAt)}</span>
        <span>
          {match.status === 'LIVE' ? (
            <span className="font-bold text-live">AO VIVO</span>
          ) : decided ? (
            'Encerrada'
          ) : (
            formatTime(match.kickoffAt)
          )}
        </span>
      </div>
    </Link>
  );
}

function BracketSide({
  club,
  score,
  penalties,
  isWinner,
  dimmed,
}: {
  club: BracketMatch['home'];
  score: number | null;
  penalties: number | null;
  isWinner: boolean;
  dimmed: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 transition-colors',
        isWinner && 'bg-accent/5',
        dimmed && 'opacity-50',
      )}
    >
      {isWinner ? (
        <span className="h-6 w-0.5 shrink-0 rounded-full bg-accent" aria-label="Classificado" />
      ) : (
        <span className="h-6 w-0.5 shrink-0" />
      )}

      {club ? (
        <ClubCrest club={club} size={22} />
      ) : (
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md border border-dashed border-line-strong text-[0.6rem] text-subtle">
          ?
        </span>
      )}

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          isWinner ? 'font-bold text-fg' : 'font-medium text-muted',
          !club && 'text-subtle italic',
        )}
      >
        {club?.shortName ?? 'A definir'}
      </span>

      <span className="shrink-0 text-right">
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isWinner ? 'font-bold text-accent' : 'text-muted',
          )}
        >
          {score ?? '–'}
        </span>
        {penalties !== null ? (
          <span className="ml-1 font-mono text-[0.65rem] text-subtle">({penalties})</span>
        ) : null}
      </span>
    </div>
  );
}
