import type { Tournament } from "@/backend";

export type Elimination = "single" | "double";
export type BracketLane = "winners" | "losers" | "grandFinal" | "resetFinal";
export type PlayerStatus =
  | "waiting"
  | "ready"
  | "playing"
  | "advanced"
  | "eliminated"
  | "champion"
  | "removed";
export type MatchStatus =
  | "pending"
  | "ready"
  | "playing"
  | "completed"
  | "bye"
  | "void";

export interface TournamentPlayerView {
  id: bigint;
  name: string;
  skill: number;
  registrationNumber: bigint;
  registeredAt: bigint;
  status: PlayerStatus;
  losses: number;
  currentMatchId?: bigint;
  table?: number;
  seed?: bigint;
  manualOverride: boolean;
}

export type MatchSourceView =
  | { kind: "player"; id: bigint }
  | { kind: "winner"; id: bigint }
  | { kind: "loser"; id: bigint }
  | { kind: "bye" }
  | { kind: "empty" };

export interface TournamentMatchView {
  id: bigint;
  bracket: BracketLane;
  round: number;
  position: number;
  playerAId?: bigint;
  playerBId?: bigint;
  sourceA: MatchSourceView;
  sourceB: MatchSourceView;
  status: MatchStatus;
  scoreA?: number;
  scoreB?: number;
  winnerId?: bigint;
  table?: number;
  manualOverride: boolean;
  prioritized: boolean;
}

export interface TournamentManagerView {
  tournament: Tournament;
  elimination: Elimination;
  tableCount: number;
  started: boolean;
  generated: boolean;
  complete: boolean;
  canChangeFormat: boolean;
  players: TournamentPlayerView[];
  matches: TournamentMatchView[];
  waitingQueue: bigint[];
  nextMatches: bigint[];
  tables: {
    number: number;
    status: "available" | "waiting" | "playing" | "finished";
    matchId?: bigint;
  }[];
  history: { id: bigint; label: string; createdAt: bigint }[];
  canUndo: boolean;
  championId?: bigint;
  undoCount: number;
}

export const SKILL_LEVELS = [
  "Beginner",
  "Lower Intermediate",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

export const BRACKET_LABELS: Record<BracketLane, string> = {
  winners: "Winners bracket",
  losers: "Losers bracket",
  grandFinal: "Grand final",
  resetFinal: "Reset final",
};

export function registrationLabel(registration: bigint) {
  return `#${registration.toString().padStart(3, "0")}`;
}

export function matchLabel(match: TournamentMatchView) {
  const lane =
    match.bracket === "winners"
      ? "W"
      : match.bracket === "losers"
        ? "L"
        : match.bracket === "grandFinal"
          ? "GF"
          : "RF";
  return `${lane}${match.round}.${match.position}`;
}

export function playerById(players: TournamentPlayerView[], id?: bigint) {
  return id === undefined
    ? undefined
    : players.find((player) => player.id === id);
}

/** Only unplayed WB/LB positions can move; a fresh queue entrant may be placed. */
export function playerMovement(
  view: TournamentManagerView,
  player: TournamentPlayerView,
): {
  entrant: boolean;
  current?: TournamentMatchView;
  targets: TournamentMatchView[];
} {
  const fresh = playerById(view.players, player.id) ?? player;
  const none = { entrant: false, targets: [] };
  if (
    fresh.status !== "waiting" &&
    fresh.status !== "ready" &&
    fresh.status !== "advanced"
  )
    return none;
  const pending = view.matches.filter(
    (match) =>
      (match.bracket === "winners" || match.bracket === "losers") &&
      (match.status === "ready" || match.status === "pending"),
  );
  const contains = (match: TournamentMatchView) =>
    match.playerAId === fresh.id || match.playerBId === fresh.id;
  const current =
    pending.find(
      (match) => match.id === fresh.currentMatchId && contains(match),
    ) ?? pending.find(contains);
  if (current) {
    return {
      entrant: false,
      current,
      targets: pending
        .filter(
          (match) =>
            match.bracket === current.bracket && match.round === current.round,
        )
        .sort(
          (a, b) => Number(a.id === current.id) - Number(b.id === current.id),
        ),
    };
  }
  const placed = view.matches.some(
    (match) =>
      contains(match) ||
      (match.sourceA.kind === "player" && match.sourceA.id === fresh.id) ||
      (match.sourceB.kind === "player" && match.sourceB.id === fresh.id),
  );
  const entrant = !placed && view.waitingQueue.includes(fresh.id);
  return {
    entrant,
    current: undefined,
    targets: entrant
      ? view.matches.filter(
          (match) =>
            match.bracket === "winners" &&
            match.round >= 1 &&
            match.status !== "playing" &&
            match.status !== "completed" &&
            match.status !== "void",
        )
      : [],
  };
}

export function sourceLabel(
  source: MatchSourceView,
  matches: TournamentMatchView[],
) {
  if (source.kind === "bye") return "BYE";
  if (source.kind === "empty") return "Awaiting player";
  if (source.kind === "player") return "Awaiting player";
  const match = matches.find((item) => item.id === source.id);
  return `${source.kind === "winner" ? "Winner" : "Loser"} / ${match ? matchLabel(match) : `M${source.id}`}`;
}

export function tbilisiTime(timestamp: bigint) {
  return new Date(Number(timestamp / 1_000_000n)).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tbilisi",
    hourCycle: "h23",
  });
}
