import {
  type Backend,
  type MatchSource,
  type Tournament,
  type TournamentCommand,
  TournamentElimination,
  TournamentSlot,
  type TournamentState,
} from "@/backend";
import type {
  Elimination,
  MatchSourceView,
  TournamentManagerView,
} from "@/types/tournament-manager";

export type OrganizerAction =
  | { kind: "configure"; elimination: Elimination; tableCount: number }
  | { kind: "addPlayer"; name: string; skill: number }
  | { kind: "editPlayer"; playerId: bigint; name: string; skill: number }
  | { kind: "removePlayer"; playerId: bigint }
  | { kind: "generateBracket" }
  | {
      kind: "placePlayer" | "movePlayer";
      playerId: bigint;
      matchId: bigint;
      slot: "a" | "b";
    }
  | {
      kind: "swapPlayers";
      firstMatchId: bigint;
      firstSlot: "a" | "b";
      secondMatchId: bigint;
      secondSlot: "a" | "b";
    }
  | {
      kind: "setMatchPlayers";
      matchId: bigint;
      playerA?: bigint;
      playerB?: bigint;
    }
  | { kind: "assignBye"; matchId: bigint; slot: "a" | "b" }
  | { kind: "assignTable"; matchId: bigint; table?: number }
  | { kind: "startMatch"; matchId: bigint }
  | { kind: "recordResult"; matchId: bigint; scoreA: number; scoreB: number }
  | { kind: "resetMatch"; matchId: bigint; cascade: boolean }
  | { kind: "prioritizeMatch"; matchId: bigint }
  | { kind: "prioritizePlayer"; playerId: bigint }
  | { kind: "undo" };

function normalizeSource(source: MatchSource): MatchSourceView {
  switch (source.__kind__) {
    case "player":
      return { kind: "player", id: source.player };
    case "winner":
      return { kind: "winner", id: source.winner };
    case "loser":
      return { kind: "loser", id: source.loser };
    case "bye":
      return { kind: "bye" };
  }
}

/** Keep generated canister types at the service boundary. */
export function normalizeTournamentState(
  state: TournamentState,
  tournament: Tournament,
): TournamentManagerView {
  return {
    tournament,
    elimination:
      state.elimination === TournamentElimination.doubleElimination
        ? "double"
        : "single",
    tableCount: Number(state.tableCount),
    started: state.started,
    generated: state.matches.length > 0,
    complete: state.championId !== undefined,
    canChangeFormat: !state.matches.some(
      (match) => match.status === "playing" || match.status === "completed",
    ),
    championId: state.championId,
    canUndo: state.canUndo,
    undoCount: state.history.length,
    history: state.history.map((action) => ({
      id: action.id,
      label: action.caption,
      createdAt: action.createdAt,
    })),
    waitingQueue: state.waitingQueue,
    nextMatches: state.nextMatches,
    tables: state.tables.map((table) => ({
      number: Number(table.number),
      status: table.status,
      matchId: table.matchId,
    })),
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      skill: Number(player.skillLevel),
      registrationNumber: player.registrationNumber,
      registeredAt: player.registeredAt,
      status: player.status,
      losses: Number(player.losses),
      seed: player.seed,
      currentMatchId: player.currentMatchId,
      table: player.table === undefined ? undefined : Number(player.table),
      manualOverride: state.matches.some(
        (match) =>
          match.manualOverride &&
          (match.playerA === player.id || match.playerB === player.id),
      ),
    })),
    matches: state.matches.map((match) => ({
      id: match.id,
      bracket: match.bracket,
      round: Number(match.round),
      position: Number(match.position),
      sourceA: normalizeSource(match.sourceA),
      sourceB: normalizeSource(match.sourceB),
      playerAId: match.playerA,
      playerBId: match.playerB,
      scoreA: match.scoreA === undefined ? undefined : Number(match.scoreA),
      scoreB: match.scoreB === undefined ? undefined : Number(match.scoreB),
      winnerId: match.winnerId,
      table: match.table === undefined ? undefined : Number(match.table),
      status:
        match.status === "blocked"
          ? "pending"
          : match.status === "cancelled"
            ? "void"
            : match.status,
      manualOverride: match.manualOverride,
      prioritized: match.priority !== 0n,
    })),
  };
}

function toCommand(action: OrganizerAction): TournamentCommand {
  const slot = (value: "a" | "b") =>
    value === "a" ? TournamentSlot.a : TournamentSlot.b;
  switch (action.kind) {
    case "configure":
      return {
        __kind__: "configure",
        configure: {
          elimination:
            action.elimination === "double"
              ? TournamentElimination.doubleElimination
              : TournamentElimination.singleElimination,
          tableCount: BigInt(action.tableCount),
        },
      };
    case "addPlayer":
      return {
        __kind__: "addPlayer",
        addPlayer: { name: action.name, skillLevel: BigInt(action.skill) },
      };
    case "editPlayer":
      return {
        __kind__: "editPlayer",
        editPlayer: {
          playerId: action.playerId,
          name: action.name,
          skillLevel: BigInt(action.skill),
        },
      };
    case "removePlayer":
      return {
        __kind__: "removePlayer",
        removePlayer: { playerId: action.playerId, confirmed: true },
      };
    case "generateBracket":
      return { __kind__: "generateBracket", generateBracket: null };
    case "placePlayer":
      return {
        __kind__: "placePlayer",
        placePlayer: {
          playerId: action.playerId,
          matchId: action.matchId,
          slot: slot(action.slot),
        },
      };
    case "movePlayer":
      return {
        __kind__: "movePlayer",
        movePlayer: {
          playerId: action.playerId,
          matchId: action.matchId,
          slot: slot(action.slot),
        },
      };
    case "swapPlayers":
      return {
        __kind__: "swapPlayers",
        swapPlayers: {
          firstMatchId: action.firstMatchId,
          firstSlot: slot(action.firstSlot),
          secondMatchId: action.secondMatchId,
          secondSlot: slot(action.secondSlot),
        },
      };
    case "setMatchPlayers":
      return {
        __kind__: "setMatchPlayers",
        setMatchPlayers: {
          matchId: action.matchId,
          playerA: action.playerA,
          playerB: action.playerB,
        },
      };
    case "assignBye":
      return {
        __kind__: "assignBye",
        assignBye: { matchId: action.matchId, slot: slot(action.slot) },
      };
    case "assignTable":
      return {
        __kind__: "assignTable",
        assignTable: {
          matchId: action.matchId,
          table: action.table === undefined ? undefined : BigInt(action.table),
        },
      };
    case "startMatch":
      return { __kind__: "startMatch", startMatch: action.matchId };
    case "recordResult":
      return {
        __kind__: "recordResult",
        recordResult: {
          matchId: action.matchId,
          scoreA: BigInt(action.scoreA),
          scoreB: BigInt(action.scoreB),
        },
      };
    case "resetMatch":
      return {
        __kind__: "resetMatch",
        resetMatch: { matchId: action.matchId, cascade: action.cascade },
      };
    case "prioritizeMatch":
      return { __kind__: "prioritizeMatch", prioritizeMatch: action.matchId };
    case "prioritizePlayer":
      return {
        __kind__: "prioritizePlayer",
        prioritizePlayer: action.playerId,
      };
    case "undo":
      return { __kind__: "undo", undo: null };
  }
}

export class TournamentManagerService {
  async get(actor: Backend, id: bigint): Promise<TournamentManagerView | null> {
    const [state, tournament] = await Promise.all([
      actor.getTournamentState(id),
      actor.getTournament(id),
    ]);
    return state && tournament
      ? normalizeTournamentState(state, tournament)
      : null;
  }

  async apply(
    actor: Backend,
    id: bigint,
    action: OrganizerAction,
    tournament: Tournament,
  ): Promise<TournamentManagerView> {
    const state = await actor.applyTournamentCommand(id, toCommand(action));
    return normalizeTournamentState(state, tournament);
  }
}

export const tournamentManagerService = new TournamentManagerService();
