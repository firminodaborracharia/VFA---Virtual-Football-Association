import { CircleDot, MapPin, SquareIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { Badge, LiveBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getMatchAppearances,
  getMatchById,
  getMatchEvents,
} from '@/lib/queries';
import { cn, formatLongDate, formatTime, MATCH_STATUS_LABELS, POSITION_SHORT } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) return { title: 'Partida não encontrada' };

  const score =
    match.homeScore !== null && match.awayScore !== null
      ? ` ${match.homeScore} × ${match.awayScore} `
      : ' × ';

  return {
    title: `${match.homeShort}${score}${match.awayShort}`,
    description: `${match.competitionName} — ${match.homeName} contra ${match.awayName}.`,
  };
}

const EVENT_LABELS = {
  GOAL: 'Gol',
  PENALTY_GOAL: 'Gol de pênalti',
  OWN_GOAL: 'Gol contra',
  PENALTY_MISS: 'Pênalti perdido',
  YELLOW_CARD: 'Cartão amarelo',
  RED_CARD: 'Cartão vermelho',
} as const;

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) notFound();

  const [events, appearances] = await Promise.all([getMatchEvents(id), getMatchAppearances(id)]);

  const decided =
    match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null;

  const homeEvents = events.filter((event) => event.clubId === match.homeId);
  const awayEvents = events.filter((event) => event.clubId === match.awayId);
  const homeSquad = appearances.filter((row) => row.clubId === match.homeId);
  const awaySquad = appearances.filter((row) => row.clubId === match.awayId);

  return (
    <>
      {/* ══════════ PLACAR ══════════ */}
      <header
        className="relative overflow-hidden border-b border-line"
        style={{
          backgroundImage: `linear-gradient(100deg, ${match.homeColor}1f 0%, transparent 45%, transparent 55%, ${match.awayColor}1f 100%)`,
        }}
      >
        <div className="container-vfa py-10 sm:py-14">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-center">
            <Link href={`/competicoes/${match.competitionSlug}`}>
              <Badge tone="accent" className="cursor-pointer hover:brightness-125">
                {match.competitionName}
              </Badge>
            </Link>
            {match.roundName ? <Badge>{match.roundName}</Badge> : null}
            {match.matchday ? <Badge>Rodada {match.matchday}</Badge> : null}
            {match.leg > 1 ? <Badge>Jogo de volta</Badge> : null}
            {match.status === 'LIVE' ? <LiveBadge /> : null}
            {match.status === 'POSTPONED' || match.status === 'CANCELLED' ? (
              <Badge tone={match.status === 'CANCELLED' ? 'loss' : 'warn'}>
                {MATCH_STATUS_LABELS[match.status]}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-center gap-4 sm:gap-10">
            <SideHeader
              slug={match.homeSlug}
              name={match.homeName}
              short={match.homeShort}
              abbr={match.homeAbbr}
              logo={match.homeLogo}
              align="right"
            />

            <div className="shrink-0 text-center">
              {decided ? (
                <div className="font-mono text-5xl leading-none font-black tabular-nums sm:text-7xl">
                  {match.homeScore}
                  <span className="mx-2 text-line-strong">×</span>
                  {match.awayScore}
                </div>
              ) : (
                <div className="font-mono text-3xl leading-none font-black text-muted sm:text-5xl">
                  {formatTime(match.kickoffAt)}
                </div>
              )}

              {match.homePenalties !== null && match.awayPenalties !== null ? (
                <p className="mt-2 text-xs text-accent-warm">
                  Pênaltis: {match.homePenalties} × {match.awayPenalties}
                </p>
              ) : null}

              <p className="mt-3 text-xs text-subtle">{formatLongDate(match.kickoffAt)}</p>
              {match.venue ? (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs text-subtle">
                  <MapPin className="size-3" />
                  {match.venue}
                </p>
              ) : null}
            </div>

            <SideHeader
              slug={match.awaySlug}
              name={match.awayName}
              short={match.awayShort}
              abbr={match.awayAbbr}
              logo={match.awayLogo}
              align="left"
            />
          </div>
        </div>
      </header>

      <div className="container-vfa grid gap-6 py-8 lg:grid-cols-2">
        {/* ══════════ EVENTOS ══════════ */}
        <Card className="lg:col-span-2">
          <CardHeader title="Eventos da partida" icon={<CircleDot className="size-4" />} />
          {events.length === 0 ? (
            <div className="p-5">
              <p className="text-sm text-muted">
                {decided
                  ? 'Nenhum evento detalhado foi registrado para esta partida.'
                  : 'Os gols, assistências e cartões aparecem aqui quando a partida for encerrada.'}
              </p>
            </div>
          ) : (
            <div className="grid divide-line sm:grid-cols-2 sm:divide-x">
              <EventColumn events={homeEvents} align="right" />
              <EventColumn events={awayEvents} align="left" />
            </div>
          )}
        </Card>

        {/* ══════════ ESCALAÇÕES ══════════ */}
        <Card>
          <CardHeader
            title={match.homeShort}
            description="Escalação"
            icon={<ClubCrest club={{ name: match.homeName, abbreviation: match.homeAbbr, logoUrl: match.homeLogo }} size={22} />}
          />
          <SquadList squad={homeSquad} />
        </Card>

        <Card>
          <CardHeader
            title={match.awayShort}
            description="Escalação"
            icon={<ClubCrest club={{ name: match.awayName, abbreviation: match.awayAbbr, logoUrl: match.awayLogo }} size={22} />}
          />
          <SquadList squad={awaySquad} />
        </Card>

        {match.notes ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Observações" />
            <div className="p-5 text-sm whitespace-pre-line text-muted">{match.notes}</div>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function SideHeader({
  slug,
  name,
  short,
  abbr,
  logo,
  align,
}: {
  slug: string;
  name: string;
  short: string;
  abbr: string;
  logo: string | null;
  align: 'left' | 'right';
}) {
  return (
    <Link
      href={`/clubes/${slug}`}
      className={cn(
        'group flex min-w-0 flex-1 flex-col items-center gap-3',
        align === 'right' ? 'sm:items-end' : 'sm:items-start',
      )}
    >
      <ClubCrest club={{ name, abbreviation: abbr, logoUrl: logo }} size={72} priority className="rounded-2xl" />
      <span className="text-center text-sm font-bold transition-colors group-hover:text-accent sm:text-lg">
        <span className="hidden sm:inline">{short}</span>
        <span className="sm:hidden">{abbr}</span>
      </span>
    </Link>
  );
}

function EventColumn({
  events,
  align,
}: {
  events: Awaited<ReturnType<typeof getMatchEvents>>;
  align: 'left' | 'right';
}) {
  if (events.length === 0) {
    return <div className="p-5 text-sm text-subtle">Sem eventos registrados.</div>;
  }

  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li
          key={event.id}
          className={cn(
            'flex items-center gap-3 px-5 py-3',
            align === 'right' && 'sm:flex-row-reverse sm:text-right',
          )}
        >
          <EventIcon type={event.type} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {event.playerSlug ? (
                <Link href={`/jogadores/${event.playerSlug}`} className="hover:text-accent">
                  {event.playerName}
                </Link>
              ) : (
                <span className="text-muted">{EVENT_LABELS[event.type]}</span>
              )}
            </p>
            <p className="truncate text-xs text-subtle">
              {EVENT_LABELS[event.type]}
              {event.assistName ? (
                <>
                  {' · assistência de '}
                  <Link href={`/jogadores/${event.assistSlug}`} className="hover:text-accent">
                    {event.assistName}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {event.minute !== null ? (
            <span className="shrink-0 font-mono text-xs text-subtle tabular-nums">
              {event.minute}&apos;
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EventIcon({ type }: { type: keyof typeof EVENT_LABELS }) {
  if (type === 'YELLOW_CARD') {
    return <span className="h-4 w-3 shrink-0 rounded-[2px] bg-accent-warm" title="Cartão amarelo" />;
  }
  if (type === 'RED_CARD') {
    return <span className="h-4 w-3 shrink-0 rounded-[2px] bg-loss" title="Cartão vermelho" />;
  }
  if (type === 'OWN_GOAL') {
    return <CircleDot className="size-4 shrink-0 text-loss" />;
  }
  if (type === 'PENALTY_MISS') {
    return <SquareIcon className="size-4 shrink-0 text-subtle" />;
  }
  return <CircleDot className="size-4 shrink-0 text-accent" />;
}

function SquadList({ squad }: { squad: Awaited<ReturnType<typeof getMatchAppearances>> }) {
  if (squad.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          title="Escalação não informada"
          description="O administrador pode registrar quem jogou ao editar o resultado da partida."
          className="border-0 bg-transparent py-6"
        />
      </div>
    );
  }

  const starters = squad.filter((player) => player.started);
  const bench = squad.filter((player) => !player.started);

  return (
    <div className="p-3">
      <SquadGroup title="Titulares" players={starters} />
      {bench.length > 0 ? <SquadGroup title="Reservas" players={bench} /> : null}
    </div>
  );
}

function SquadGroup({
  title,
  players,
}: {
  title: string;
  players: Awaited<ReturnType<typeof getMatchAppearances>>;
}) {
  if (players.length === 0) return null;

  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 py-2 text-[0.7rem] font-bold tracking-widest text-subtle uppercase">
        {title}
      </p>
      <ul>
        {players.map((player) => (
          <li key={player.id}>
            <Link
              href={`/jogadores/${player.playerSlug}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
            >
              <span className="w-6 shrink-0 text-center font-mono text-xs text-subtle tabular-nums">
                {player.shirtNumber ?? '–'}
              </span>
              <PlayerAvatar
                player={{
                  displayName: player.playerName,
                  robloxHeadshotUrl: player.robloxHeadshotUrl,
                  robloxAvatarUrl: player.robloxAvatarUrl,
                }}
                size={28}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.playerName}</span>
              <span className="shrink-0 text-[0.65rem] font-bold text-subtle">
                {POSITION_SHORT[player.position]}
              </span>
              {player.minutes > 0 ? (
                <span className="w-10 shrink-0 text-right font-mono text-xs text-subtle tabular-nums">
                  {player.minutes}&apos;
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
