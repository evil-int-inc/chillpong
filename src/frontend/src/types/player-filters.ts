import {
  BRACKET_LABELS,
  type TournamentManagerView,
  type TournamentMatchView,
  type TournamentPlayerView,
} from "./tournament-manager";

export type PlayerSort = "registration" | "name" | "skill" | "status";
export interface PlayerFilters {
  search: string;
  skill: string;
  status: string;
  table: string;
  round: string;
  sort: PlayerSort;
  showRemoved: boolean;
}
export const DEFAULT_PLAYER_FILTERS: PlayerFilters = {
  search: "",
  skill: "all",
  status: "all",
  table: "all",
  round: "all",
  sort: "registration",
  showRemoved: false,
};
export const PLAYER_STATUSES = [
  "playing",
  "ready",
  "waiting",
  "advanced",
  "champion",
  "eliminated",
  "removed",
] as const;

/** A completed registration leaf is history, not the player's current round. */
export function currentPlayerMatch(
  view: TournamentManagerView,
  player: TournamentPlayerView,
) {
  const contains = (match: TournamentMatchView) =>
    match.playerAId === player.id || match.playerBId === player.id;
  const matches = view.matches.filter(
    (match) =>
      contains(match) && ["playing", "ready", "pending"].includes(match.status),
  );
  return (
    matches.find((match) => match.id === player.currentMatchId) ??
    matches.find((match) => match.status === "playing") ??
    matches.find((match) => match.status === "ready") ??
    matches[0]
  );
}

export function roundKey(match: TournamentMatchView) {
  return `${match.bracket}:${match.round}`;
}
export function roundLabel(match: TournamentMatchView) {
  return match.bracket === "grandFinal" || match.bracket === "resetFinal"
    ? BRACKET_LABELS[match.bracket]
    : `${BRACKET_LABELS[match.bracket]} / ${match.round === 0 ? "Qualifiers" : `Round ${match.round}`}`;
}

function registrationOrder(a: TournamentPlayerView, b: TournamentPlayerView) {
  if (a.registrationNumber !== b.registrationNumber)
    return a.registrationNumber < b.registrationNumber ? -1 : 1;
  if (a.registeredAt !== b.registeredAt)
    return a.registeredAt < b.registeredAt ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

export function selectPlayers(
  view: TournamentManagerView,
  filters: PlayerFilters,
) {
  const search = filters.search.trim().toLocaleLowerCase();
  return view.players
    .filter((player) => {
      const match = currentPlayerMatch(view, player);
      const table = match?.table;
      return (
        (filters.showRemoved || player.status !== "removed") &&
        (!search ||
          `${player.name} #${player.registrationNumber.toString().padStart(3, "0")}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (filters.skill === "all" || player.skill === Number(filters.skill)) &&
        (filters.status === "all" || player.status === filters.status) &&
        (filters.table === "all" ||
          (filters.table === "none"
            ? table === undefined
            : table === Number(filters.table))) &&
        (filters.round === "all" ||
          (filters.round === "none"
            ? !match
            : !!match && roundKey(match) === filters.round))
      );
    })
    .sort((a, b) => {
      const difference =
        filters.sort === "name"
          ? a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
              numeric: true,
            })
          : filters.sort === "skill"
            ? a.skill - b.skill
            : filters.sort === "status"
              ? PLAYER_STATUSES.indexOf(a.status) -
                PLAYER_STATUSES.indexOf(b.status)
              : 0;
      return difference || registrationOrder(a, b);
    });
}
