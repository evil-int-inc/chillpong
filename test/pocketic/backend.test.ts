import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  TournamentCommand,
  TournamentInput,
  TournamentState,
  UserInput,
  _SERVICE,
} from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const PIC_URL = process.env.POCKET_IC_URL ?? "";
const BACKEND_WASM = process.env.BACKEND_WASM ?? "";
const BACKEND_WASM_LEGACY = process.env.BACKEND_WASM_LEGACY ?? "";
const owner = createIdentity("chillpong-owner").getPrincipal();
const member = createIdentity("chillpong-member").getPrincipal();
// Use the SDK installed with the PocketIC client; it is not a root dependency.
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const anonymous: typeof owner = picRequire(
  "@icp-sdk/core/principal",
).Principal.anonymous();
const startsAt = BigInt(Date.parse("2026-10-09T17:00:00Z")) * 1_000_000n;

let pic: PocketIc | undefined;
let actor: Actor<_SERVICE>;
let canisterId: typeof owner;

interface LegacyUser {
  id: typeof owner;
  displayName: string;
  username: string;
  avatar: [] | [Uint8Array];
  bio: [] | [string];
  createdAt: bigint;
  role: [] | [{ admin: null }];
}

interface LegacyService {
  _initialize_access_control(): Promise<void>;
  bootstrapOwner(): Promise<void>;
  saveProfile(
    displayName: string,
    username: string,
    avatar: [] | [Uint8Array],
    removeAvatar: boolean,
    bio: [] | [string],
  ): Promise<LegacyUser>;
  grantAdminRole(
    target: typeof owner,
  ): Promise<Pick<LegacyUser, "id" | "displayName" | "username" | "role">>;
}

// The previous canister's small profile interface is enough to seed real
// legacy state without retaining retired frontend bindings in this project.
const legacyIdlFactory: typeof idlFactory = ({ IDL }) => {
  const role = IDL.Opt(IDL.Variant({ admin: IDL.Null }));
  const user = IDL.Record({
    id: IDL.Principal,
    displayName: IDL.Text,
    username: IDL.Text,
    avatar: IDL.Opt(IDL.Vec(IDL.Nat8)),
    bio: IDL.Opt(IDL.Text),
    createdAt: IDL.Int,
    role,
  });
  const userRoleView = IDL.Record({
    id: IDL.Principal,
    displayName: IDL.Text,
    username: IDL.Text,
    role,
  });
  return IDL.Service({
    _initialize_access_control: IDL.Func([], [], []),
    bootstrapOwner: IDL.Func([], [], []),
    saveProfile: IDL.Func(
      [
        IDL.Text,
        IDL.Text,
        IDL.Opt(IDL.Vec(IDL.Nat8)),
        IDL.Bool,
        IDL.Opt(IDL.Text),
      ],
      [user],
      [],
    ),
    grantAdminRole: IDL.Func([IDL.Principal], [userRoleView], []),
  });
};

function userInput(overrides: Partial<UserInput> = {}): UserInput {
  return { displayName: "Nino", username: "nino", bio: [], ...overrides };
}

function tournamentInput(
  overrides: Partial<TournamentInput> = {},
): TournamentInput {
  return {
    title: "Warehouse Cup",
    description: "Bring your paddle",
    venue: "ChillPong Bar",
    startsAt,
    format: { singles: null },
    capacity: 16n,
    status: { upcoming: null },
    ...overrides,
  };
}

beforeAll(async () => {
  pic = await PocketIc.create(PIC_URL);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: BACKEND_WASM,
  }));
  actor.setPrincipal(owner);
  await actor._initialize_access_control();
  await actor.bootstrapOwner();
  await actor.createUser(
    owner,
    userInput({ displayName: "Owner", username: "owner" }),
  );
  await actor.createUser(
    member,
    userInput({ displayName: "Member", username: "member" }),
  );
  actor.setPrincipal(member);
  await actor._initialize_access_control();
});

interface TournamentRoom {
  id: bigint;
  state: TournamentState;
}

async function applyRoom(room: TournamentRoom, command: TournamentCommand) {
  room.state = await actor.applyTournamentCommand(room.id, command);
  return room.state;
}

async function createRoom(
  levels: number[],
  doubleElimination = false,
  names = levels.map((_, index) => `Player ${index + 1}`),
) {
  const tournament = await actor.createTournament(
    tournamentInput({ capacity: BigInt(Math.max(2, levels.length)) }),
  );
  const room: TournamentRoom = {
    id: tournament.id,
    state: (await actor.getTournamentState(tournament.id))[0]!,
  };
  await applyRoom(room, {
    configure: {
      elimination: doubleElimination
        ? { doubleElimination: null }
        : { singleElimination: null },
      tableCount: 2n,
    },
  });
  for (let index = 0; index < levels.length; index += 1) {
    await applyRoom(room, {
      addPlayer: { name: names[index]!, skillLevel: BigInt(levels[index]!) },
    });
  }
  return room;
}

function matchPlayers(
  state: TournamentState,
  match: TournamentState["matches"][number],
) {
  return [match.playerA[0], match.playerB[0]]
    .filter((id): id is bigint => id !== undefined)
    .map((id) => state.players.find((player) => player.id === id)!);
}

function readyMatches(state: TournamentState) {
  return state.matches.filter((match) => "ready" in match.status);
}

async function playResult(
  room: TournamentRoom,
  matchId: bigint,
  winnerId?: bigint,
) {
  const match = room.state.matches.find((item) => item.id === matchId)!;
  if ("ready" in match.status) {
    await applyRoom(room, { assignTable: { matchId, table: [1n] } });
    await applyRoom(room, { startMatch: matchId });
  }
  const aWins = winnerId === undefined || match.playerA[0] === winnerId;
  return applyRoom(room, {
    recordResult: {
      matchId,
      scoreA: aWins ? 11n : 7n,
      scoreB: aWins ? 7n : 11n,
    },
  });
}

async function finishRoom(room: TournamentRoom, resetFinal = false) {
  let played = 0;
  while (room.state.championId.length === 0) {
    const match =
      room.state.nextMatches
        .map((id) => room.state.matches.find((item) => item.id === id)!)
        .find((item) => "ready" in item.status || "playing" in item.status) ??
      readyMatches(room.state)[0];
    expect(
      match,
      "A live tournament must have a playable next match",
    ).toBeDefined();
    let winnerId: bigint | undefined;
    if (resetFinal && "grandFinal" in match!.bracket) {
      winnerId = matchPlayers(room.state, match!).find(
        (player) => player.losses === 1n,
      )!.id;
    }
    await playResult(room, match!.id, winnerId);
    played += 1;
    expect(played).toBeLessThanOrEqual(
      Math.min(600, room.state.players.length * 2),
    );
    if ("doubleElimination" in room.state.elimination) {
      for (const player of room.state.players) {
        if ("eliminated" in player.status) expect(player.losses).toBe(2n);
      }
    }
  }
  return played;
}

describe("tournament organizer engine", () => {
  it("keeps organizer commands admin-only while exposing the room to spectators", async () => {
    const room = await createRoom([2, 2]);
    actor.setPrincipal(anonymous);
    expect(await actor.getTournamentState(room.id)).toEqual([room.state]);
    await expect(
      actor.applyTournamentCommand(room.id, {
        addPlayer: { name: "Intruder", skillLevel: 1n },
      }),
    ).rejects.toThrow(/Unauthorized/);
    actor.setPrincipal(member);
    await expect(
      actor.applyTournamentCommand(room.id, { generateBracket: null }),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      actor.applyTournamentCommand(room.id, { undo: null }),
    ).rejects.toThrow(/Unauthorized/);
    expect((await actor.getTournamentState(room.id))[0]?.players).toEqual(
      room.state.players,
    );
  });

  it("uses same-level pairing before registration order, matching the brief's lineup", async () => {
    const room = await createRoom([2, 2, 2, 3, 2, 3, 1, 1], false, [
      "Alex",
      "John",
      "Mike",
      "David",
      "Peter",
      "Sarah",
      "Late A",
      "Late B",
    ]);
    const registrations = room.state.players.map((player) => ({
      id: player.id,
      number: player.registrationNumber,
      time: player.registeredAt,
    }));
    await applyRoom(room, { generateBracket: null });
    const next = room.state.nextMatches
      .slice(0, 3)
      .map((id) =>
        matchPlayers(
          room.state,
          room.state.matches.find((match) => match.id === id)!,
        ).map((player) => player.name),
      );
    expect(next).toEqual([
      ["Alex", "John"],
      ["Mike", "Peter"],
      ["David", "Sarah"],
    ]);
    expect(
      room.state.players.map((player) => ({
        id: player.id,
        number: player.registrationNumber,
        time: player.registeredAt,
      })),
    ).toEqual(registrations);
  });

  it("pairs an unmatched lower level with the closest available higher level", async () => {
    const room = await createRoom([2, 5, 3, 4]);
    await applyRoom(room, { generateBracket: null });
    const pairs = readyMatches(room.state).map((match) =>
      matchPlayers(room.state, match)
        .map((player) => Number(player.registrationNumber))
        .sort(),
    );
    expect(pairs).toContainEqual([1, 3]);
    expect(pairs).toContainEqual([2, 4]);
  });

  it("gives six first-round byes to earlier weaker players in a ten-player bracket", async () => {
    const room = await createRoom([5, 5, 1, 1, 1, 1, 1, 1, 1, 1]);
    await applyRoom(room, { generateBracket: null });
    const firstRound = room.state.matches.filter(
      (match) => "winners" in match.bracket && match.round === 1n,
    );
    expect(firstRound).toHaveLength(8);
    const byes = firstRound.filter((match) => "bye" in match.status);
    expect(byes).toHaveLength(6);
    expect(
      byes
        .flatMap((match) =>
          matchPlayers(room.state, match).map(
            (player) => player.registrationNumber,
          ),
        )
        .sort((a, b) => Number(a - b)),
    ).toEqual([3n, 4n, 5n, 6n, 7n, 8n]);
    expect(room.state.players.every((player) => player.losses === 0n)).toBe(
      true,
    );
    expect(await finishRoom(room)).toBe(9);
    expect(
      room.state.players.filter((player) => player.losses === 1n),
    ).toHaveLength(9);
    expect(
      room.state.players.find(
        (player) => player.id === room.state.championId[0],
      )?.losses,
    ).toBe(0n);
  }, 30_000);

  it("finishes a 101-player single-elimination tournament in exactly 100 scored matches", async () => {
    const room = await createRoom(
      Array.from({ length: 101 }, (_, index) => (index % 5) + 1),
    );
    await applyRoom(room, { generateBracket: null });
    expect(
      room.state.matches.filter((match) => "winners" in match.bracket),
    ).toHaveLength(127);
    expect(
      room.state.matches.filter((match) => "bye" in match.status),
    ).toHaveLength(27);
    expect(await finishRoom(room)).toBe(100);
    expect(
      room.state.players.filter((player) => "eliminated" in player.status),
    ).toHaveLength(100);
    expect(
      room.state.players.filter((player) => "champion" in player.status),
    ).toHaveLength(1);
  }, 60_000);

  it.each([
    { count: 2, reset: true },
    { count: 5, reset: false },
  ])(
    "requires two losses in $count-player double elimination (reset=$reset)",
    async ({ count, reset }) => {
      const room = await createRoom(
        Array.from({ length: count }, () => 3),
        true,
      );
      await applyRoom(room, { generateBracket: null });
      const played = await finishRoom(room, reset);
      expect(played).toBe(count * 2 - (reset ? 1 : 2));
      const champion = room.state.players.find(
        (player) => player.id === room.state.championId[0],
      )!;
      expect(champion.losses).toBe(reset ? 1n : 0n);
      for (const player of room.state.players.filter(
        (item) => item.id !== champion.id,
      )) {
        expect(player.losses).toBe(2n);
        expect(player.status).toEqual({ eliminated: null });
      }
      const final = room.state.matches.find(
        (match) => "resetFinal" in match.bracket,
      )!;
      expect(final.status).toEqual(
        reset ? { completed: null } : { cancelled: null },
      );
    },
    30_000,
  );

  it("finishes a 129-player double-elimination tournament with exactly two losses for every non-champion", async () => {
    const room = await createRoom(
      Array.from({ length: 129 }, (_, index) => (index % 5) + 1),
      true,
    );
    await applyRoom(room, { generateBracket: null });
    expect(
      room.state.matches.filter((match) => "winners" in match.bracket),
    ).toHaveLength(255);
    expect(
      room.state.matches.filter((match) => "losers" in match.bracket),
    ).toHaveLength(254);
    expect(
      room.state.matches.filter(
        (match) =>
          "winners" in match.bracket &&
          match.round === 1n &&
          "bye" in match.status,
      ),
    ).toHaveLength(127);
    const entrants = readyMatches(room.state).flatMap((match) =>
      matchPlayers(room.state, match).map((player) => player.id),
    );
    expect(new Set(entrants).size).toBe(entrants.length);
    expect(room.state.championId).toEqual([]);
    expect(await finishRoom(room)).toBe(256);
    const champion = room.state.players.find(
      (player) => player.id === room.state.championId[0],
    )!;
    expect(champion.status).toEqual({ champion: null });
    expect(champion.losses).toBe(0n);
    for (const player of room.state.players.filter(
      (item) => item.id !== champion.id,
    )) {
      expect(player.losses).toBe(2n);
      expect(player.status).toEqual({ eliminated: null });
    }
  }, 120_000);

  it.each([
    { double: false, remainingGames: 2 },
    { double: true, remainingGames: 6 },
  ])(
    "qualifies a late entrant without changing an unrelated active match (double=$double)",
    async ({ double, remainingGames }) => {
      const room = await createRoom([2, 2, 2, 2], double);
      await applyRoom(room, { generateBracket: null });
      const matchId = readyMatches(room.state)[0]!.id;
      await applyRoom(room, { assignTable: { matchId, table: [1n] } });
      await applyRoom(room, { startMatch: matchId });
      const active = room.state.matches.find((match) => match.id === matchId)!;
      const registrations = room.state.players.map((player) => ({
        id: player.id,
        number: player.registrationNumber,
        time: player.registeredAt,
      }));
      await applyRoom(room, {
        addPlayer: { name: "Late Arrival", skillLevel: 2n },
      });
      const late = room.state.players.find(
        (player) => player.name === "Late Arrival",
      )!;
      expect(late.registrationNumber).toBe(5n);
      expect(
        room.state.players.slice(0, 4).map((player) => ({
          id: player.id,
          number: player.registrationNumber,
          time: player.registeredAt,
        })),
      ).toEqual(registrations);
      expect(room.state.matches.find((match) => match.id === matchId)).toEqual(
        active,
      );
      expect(room.state.waitingQueue).toContain(late.id);
      expect(
        room.state.tables.find((table) => table.number === 1n)?.matchId,
      ).toEqual([matchId]);
      const target = readyMatches(room.state).find(
        (match) => match.id !== matchId,
      )!;
      const originalEntrant = target.playerA[0]!;
      await applyRoom(room, {
        placePlayer: {
          playerId: late.id,
          matchId: target.id,
          slot: { a: null },
        },
      });
      const qualifier = room.state.matches.find(
        (match) =>
          match.round === 0n &&
          matchPlayers(room.state, match).some(
            (player) => player.id === late.id,
          ),
      )!;
      expect(qualifier).toBeDefined();
      expect(qualifier.status).toEqual({ ready: null });
      expect(
        new Set(matchPlayers(room.state, qualifier).map((player) => player.id)),
      ).toEqual(new Set([originalEntrant, late.id]));
      expect(
        room.state.matches.find((match) => match.id === target.id)?.sourceA,
      ).toEqual({ winner: qualifier.id });
      expect(
        room.state.matches.find((match) => match.id === target.id)?.status,
      ).toEqual({ blocked: null });
      expect(room.state.matches.find((match) => match.id === matchId)).toEqual(
        active,
      );
      if (double) {
        const lowerQualifier = room.state.matches.find(
          (match) => match.round === 0n && "losers" in match.bracket,
        )!;
        expect(lowerQualifier).toBeDefined();
        expect([lowerQualifier.sourceA, lowerQualifier.sourceB]).toEqual(
          expect.arrayContaining([
            { loser: qualifier.id },
            { loser: target.id },
          ]),
        );
      }
      await playResult(room, matchId);
      await playResult(room, qualifier.id, late.id);
      expect(
        room.state.matches.find((match) => match.id === target.id)?.playerA,
      ).toEqual([late.id]);
      expect(await finishRoom(room)).toBe(remainingGames);
      for (const player of room.state.players.filter(
        (item) => item.id !== room.state.championId[0],
      )) {
        expect(player.losses).toBe(double ? 2n : 1n);
      }
    },
    30_000,
  );

  it("requires withdrawal confirmation and never rewrites a completed result", async () => {
    const room = await createRoom([3, 3, 3, 3]);
    await applyRoom(room, { generateBracket: null });
    const match = readyMatches(room.state)[0]!;
    const first = match.playerA[0]!;
    await expect(
      actor.applyTournamentCommand(room.id, {
        removePlayer: { playerId: first, confirmed: false },
      }),
    ).rejects.toThrow(/confirm/i);
    await playResult(room, match.id);
    const completed = room.state.matches.find((item) => item.id === match.id)!;
    const loser = completed.loserId[0]!;
    await expect(
      actor.applyTournamentCommand(room.id, {
        removePlayer: { playerId: loser, confirmed: false },
      }),
    ).rejects.toThrow(/confirm/i);
    await applyRoom(room, {
      removePlayer: { playerId: loser, confirmed: true },
    });
    expect(room.state.matches.find((item) => item.id === match.id)).toEqual(
      completed,
    );
    expect(room.state.waitingQueue).not.toContain(loser);
    expect(
      room.state.players.find((player) => player.id === loser)?.status,
    ).toEqual({ removed: null });
  });

  it("prevents table conflicts, rejects drawn scores, and frees the table after a result", async () => {
    const room = await createRoom([3, 3, 3, 3]);
    await applyRoom(room, { generateBracket: null });
    const [first, second] = readyMatches(room.state);
    await applyRoom(room, { assignTable: { matchId: first!.id, table: [1n] } });
    await applyRoom(room, { startMatch: first!.id });
    await expect(
      actor.applyTournamentCommand(room.id, {
        assignTable: { matchId: second!.id, table: [1n] },
      }),
    ).rejects.toThrow(/table|occupied|playing/i);
    await expect(
      actor.applyTournamentCommand(room.id, {
        recordResult: { matchId: first!.id, scoreA: 7n, scoreB: 7n },
      }),
    ).rejects.toThrow(/tie|draw|winner|different/i);
    await playResult(room, first!.id);
    expect(
      room.state.tables.find((table) => table.number === 1n)?.status,
    ).toEqual({ finished: null });
    await applyRoom(room, {
      assignTable: { matchId: second!.id, table: [1n] },
    });
    expect(
      room.state.tables.find((table) => table.number === 1n)?.matchId,
    ).toEqual([second!.id]);
  });

  it("changes an unplayed draw's format without changing registrations and protects occupied tables", async () => {
    const room = await createRoom([2, 2, 3, 3]);
    const registrations = room.state.players.map((player) => [
      player.id,
      player.registrationNumber,
      player.registeredAt,
    ]);
    await applyRoom(room, { generateBracket: null });
    await applyRoom(room, {
      configure: { elimination: { doubleElimination: null }, tableCount: 2n },
    });
    expect(room.state.elimination).toEqual({ doubleElimination: null });
    expect(room.state.matches.some((match) => "losers" in match.bracket)).toBe(
      true,
    );
    expect(
      room.state.players.map((player) => [
        player.id,
        player.registrationNumber,
        player.registeredAt,
      ]),
    ).toEqual(registrations);
    const matchId = readyMatches(room.state)[0]!.id;
    await applyRoom(room, { assignTable: { matchId, table: [2n] } });
    await applyRoom(room, { startMatch: matchId });
    await expect(
      actor.applyTournamentCommand(room.id, {
        configure: { elimination: { singleElimination: null }, tableCount: 2n },
      }),
    ).rejects.toThrow(/format|started/i);
    await expect(
      actor.applyTournamentCommand(room.id, {
        configure: { elimination: { doubleElimination: null }, tableCount: 1n },
      }),
    ).rejects.toThrow(/occupied|tables/i);
    await playResult(room, matchId);
    await applyRoom(room, {
      configure: { elimination: { doubleElimination: null }, tableCount: 1n },
    });
    expect(room.state.tableCount).toBe(1n);
    expect(
      room.state.players.map((player) => [
        player.id,
        player.registrationNumber,
        player.registeredAt,
      ]),
    ).toEqual(registrations);
  });

  it("requires a cascade before resetting a result that has already fed the completed final", async () => {
    const room = await createRoom([3, 3, 3, 3]);
    await applyRoom(room, { generateBracket: null });
    const [first, second] = readyMatches(room.state);
    await playResult(room, first!.id);
    await playResult(room, second!.id);
    const final = readyMatches(room.state)[0]!;
    await playResult(room, final.id);
    const registrations = room.state.players.map((player) => [
      player.id,
      player.registrationNumber,
      player.registeredAt,
    ]);
    const scoredFinal = room.state.matches.find(
      (match) => match.id === final.id,
    )!;
    const unchangedSecond = room.state.matches.find(
      (match) => match.id === second!.id,
    )!;
    await expect(
      actor.applyTournamentCommand(room.id, {
        recordResult: { matchId: first!.id, scoreA: 7n, scoreB: 11n },
      }),
    ).rejects.toThrow(/dependent|reset/i);
    await expect(
      actor.applyTournamentCommand(room.id, {
        resetMatch: { matchId: first!.id, cascade: false },
      }),
    ).rejects.toThrow(/cascade|confirm/i);
    expect(
      (await actor.getTournamentState(room.id))[0]?.matches.find(
        (match) => match.id === final.id,
      ),
    ).toEqual(scoredFinal);
    await applyRoom(room, {
      resetMatch: { matchId: first!.id, cascade: true },
    });
    expect(room.state.championId).toEqual([]);
    expect(
      room.state.matches.find((match) => match.id === first!.id)?.status,
    ).toEqual({ ready: null });
    expect(
      room.state.matches.find((match) => match.id === final.id)?.scoreA,
    ).toEqual([]);
    expect(
      room.state.matches.find((match) => match.id === final.id)?.status,
    ).toEqual({ blocked: null });
    expect(room.state.matches.find((match) => match.id === second!.id)).toEqual(
      unchangedSecond,
    );
    expect(
      room.state.players.map((player) => [
        player.id,
        player.registrationNumber,
        player.registeredAt,
      ]),
    ).toEqual(registrations);
  });

  it("preserves the champion and final score when the final loser withdraws afterward", async () => {
    const room = await createRoom([3, 3]);
    await applyRoom(room, { generateBracket: null });
    const final = readyMatches(room.state)[0]!;
    await playResult(room, final.id);
    const completed = room.state.matches.find(
      (match) => match.id === final.id,
    )!;
    const championId = room.state.championId;
    const loserId = completed.loserId[0]!;
    const loser = room.state.players.find((player) => player.id === loserId)!;
    await applyRoom(room, {
      editPlayer: {
        playerId: loserId,
        name: "Updated finalist",
        skillLevel: 5n,
      },
    });
    expect(
      room.state.players.find((player) => player.id === loserId),
    ).toMatchObject({
      name: "Updated finalist",
      skillLevel: 5n,
      registrationNumber: loser.registrationNumber,
      registeredAt: loser.registeredAt,
    });
    await expect(
      actor.applyTournamentCommand(room.id, {
        removePlayer: { playerId: loserId, confirmed: false },
      }),
    ).rejects.toThrow(/confirm/i);
    await applyRoom(room, {
      removePlayer: { playerId: loserId, confirmed: true },
    });
    expect(room.state.matches.find((match) => match.id === final.id)).toEqual(
      completed,
    );
    expect(room.state.championId).toEqual(championId);
    expect(
      room.state.players.find((player) => player.id === loserId)?.status,
    ).toEqual({ removed: null });
  });

  it("keeps player and match IDs monotonic through undo and supports a flagged manual swap", async () => {
    const room = await createRoom([2, 2, 2, 2]);
    await applyRoom(room, {
      addPlayer: { name: "Undone Registration", skillLevel: 3n },
    });
    const undone = room.state.players.find(
      (player) => player.name === "Undone Registration",
    )!;
    await applyRoom(room, { undo: null });
    await applyRoom(room, {
      addPlayer: { name: "Replacement Registration", skillLevel: 3n },
    });
    const replacement = room.state.players.find(
      (player) => player.name === "Replacement Registration",
    )!;
    expect(replacement.id).toBeGreaterThan(undone.id);
    expect(replacement.registrationNumber).toBeGreaterThan(
      undone.registrationNumber,
    );
    await applyRoom(room, {
      removePlayer: { playerId: replacement.id, confirmed: false },
    });
    await applyRoom(room, { generateBracket: null });
    const oldMatchIds = room.state.matches.map((match) => match.id);
    await applyRoom(room, { undo: null });
    await applyRoom(room, { generateBracket: null });
    expect(
      Math.min(...room.state.matches.map((match) => Number(match.id))),
    ).toBeGreaterThan(Math.max(...oldMatchIds.map(Number)));
    const before = room.state.players.map((player) => [
      player.id,
      player.registrationNumber,
      player.registeredAt,
    ]);
    const [first, second] = readyMatches(room.state);
    await applyRoom(room, {
      swapPlayers: {
        firstMatchId: first!.id,
        firstSlot: { a: null },
        secondMatchId: second!.id,
        secondSlot: { a: null },
      },
    });
    expect(
      room.state.matches.find((match) => match.id === first!.id)?.playerA,
    ).toEqual(second!.playerA);
    expect(
      room.state.matches.find((match) => match.id === second!.id)?.playerA,
    ).toEqual(first!.playerA);
    expect(
      room.state.matches
        .filter((match) => match.id === first!.id || match.id === second!.id)
        .every((match) => match.manualOverride),
    ).toBe(true);
    expect(
      room.state.players.map((player) => [
        player.id,
        player.registrationNumber,
        player.registeredAt,
      ]),
    ).toEqual(before);
  });

  it("moves advanced winners through their pending slots without rewriting their completed games, and can undo", async () => {
    const room = await createRoom(Array.from({ length: 8 }, () => 3));
    await applyRoom(room, { generateBracket: null });
    const opening = readyMatches(room.state);
    await playResult(room, opening[0]!.id);
    await playResult(room, opening[2]!.id);
    const before = room.state;
    const scored = before.matches.filter(
      (match) => "completed" in match.status,
    );
    expect(scored).toHaveLength(2);
    const winners = scored.map((match) => match.winnerId[0]!);
    const registrations = before.players.map((player) => [
      player.id,
      player.registrationNumber,
      player.registeredAt,
    ]);
    for (let index = 0; index < winners.length; index += 1) {
      const playerId = winners[index]!;
      const previousMatchId = before.players.find(
        (player) => player.id === playerId,
      )!.currentMatchId[0]!;
      const otherWinner = winners[1 - index]!;
      const targetId = before.players.find(
        (player) => player.id === otherWinner,
      )!.currentMatchId[0]!;
      const target = before.matches.find((match) => match.id === targetId)!;
      expect(target.round).toBe(2n);
      expect(target.status).toEqual({ blocked: null });
      const slot =
        target.playerA[0] === otherWinner ? { a: null } : { b: null };
      await applyRoom(room, {
        movePlayer: { playerId, matchId: targetId, slot },
      });
      expect(
        room.state.matches.filter((match) => "completed" in match.status),
      ).toEqual(scored);
      expect(
        room.state.players.map((player) => [
          player.id,
          player.registrationNumber,
          player.registeredAt,
        ]),
      ).toEqual(registrations);
      expect(
        room.state.players.map((player) => [player.id, player.losses]),
      ).toEqual(before.players.map((player) => [player.id, player.losses]));
      expect(
        room.state.players.find((player) => player.id === playerId)
          ?.currentMatchId[0],
      ).not.toBe(previousMatchId);
      expect(
        room.state.matches.some(
          (match) =>
            match.manualOverride &&
            (match.playerA[0] === playerId || match.playerB[0] === playerId),
        ),
      ).toBe(true);
      await applyRoom(room, { undo: null });
      expect(room.state.matches).toEqual(before.matches);
      expect(room.state.players).toEqual(before.players);
      expect(room.state.tables).toEqual(before.tables);
      expect(room.state.nextMatches).toEqual(before.nextMatches);
      expect(room.state.waitingQueue).toEqual(before.waitingQueue);
      expect(room.state.history).toEqual(before.history);
    }
  }, 30_000);

  it("preserves the running bracket, scores, table occupancy and undo history across an upgrade", async () => {
    const room = await createRoom([2, 2, 2, 2], true);
    await applyRoom(room, { generateBracket: null });
    const [first, second] = readyMatches(room.state);
    await playResult(room, first!.id);
    await applyRoom(room, {
      assignTable: { matchId: second!.id, table: [2n] },
    });
    await applyRoom(room, { startMatch: second!.id });
    const before = room.state;
    await pic!.upgradeCanister({
      canisterId,
      wasm: BACKEND_WASM,
      arg: new Uint8Array(),
      upgradeModeOptions: {
        skip_pre_upgrade: [],
        wasm_memory_persistence: [{ keep: null }],
      },
    });
    expect(await actor.getTournamentState(room.id)).toEqual([before]);
    expect(before.canUndo).toBe(true);
    await applyRoom(room, { undo: null });
    expect(
      room.state.matches.find((match) => match.id === second!.id)?.status,
    ).toEqual({ ready: null });
    expect(
      room.state.matches.find((match) => match.id === first!.id)?.status,
    ).toEqual({ completed: null });
    expect(await actor.getMyRole()).toEqual([{ admin: null }]);
  }, 30_000);
});

describe.skipIf(!BACKEND_WASM_LEGACY)("legacy profile migration", () => {
  it("preserves member identities, avatars and admin roles while replacing the media schema", async () => {
    const fixture = await pic!.setupCanister<LegacyService>({
      idlFactory: legacyIdlFactory,
      wasm: BACKEND_WASM_LEGACY,
    });
    const legacy = fixture.actor;
    const avatar = new Uint8Array([9, 8, 7, 6]);
    legacy.setPrincipal(owner);
    await legacy._initialize_access_control();
    const oldOwner = await legacy.saveProfile(
      "Original Owner",
      "LegacyOwner",
      [avatar],
      false,
      ["The original crew"],
    );
    await legacy.bootstrapOwner();
    legacy.setPrincipal(member);
    await legacy._initialize_access_control();
    const oldMember = await legacy.saveProfile("Nino", "NINO", [], false, [
      "A legacy member",
    ]);
    legacy.setPrincipal(owner);
    await legacy.grantAdminRole(member);

    await pic!.upgradeCanister({
      canisterId: fixture.canisterId,
      wasm: BACKEND_WASM,
      arg: new Uint8Array(),
      upgradeModeOptions: {
        skip_pre_upgrade: [],
        wasm_memory_persistence: [{ keep: null }],
      },
    });
    const upgraded = pic!.createActor<_SERVICE>(idlFactory, fixture.canisterId);
    upgraded.setPrincipal(owner);
    await upgraded.bootstrapOwner();
    expect((await upgraded.getUser(owner))[0]).toMatchObject({
      id: oldOwner.id,
      displayName: oldOwner.displayName,
      avatar: [avatar],
      bio: oldOwner.bio,
      createdAt: oldOwner.createdAt,
      role: [{ admin: null }],
    });
    expect((await upgraded.getUser(member))[0]).toMatchObject({
      id: oldMember.id,
      displayName: oldMember.displayName,
      avatar: oldMember.avatar,
      bio: oldMember.bio,
      createdAt: oldMember.createdAt,
      role: [{ admin: null }],
    });
    expect((await upgraded.getUserByUsername("  NINO  "))[0]?.id.toText()).toBe(
      member.toText(),
    );
    await expect(
      upgraded.createUser(
        createIdentity("legacy-duplicate").getPrincipal(),
        userInput({ username: "nino" }),
      ),
    ).rejects.toThrow(/Username already taken/);
    expect(await upgraded.listUsers()).toHaveLength(2);
    const schema = JSON.parse(await upgraded.schema()) as {
      entities: Array<{ name: string }>;
    };
    expect(schema.entities.map((entity) => entity.name).sort()).toEqual([
      "tournament",
      "user",
    ]);
    expect(await upgraded.getTournaments()).toEqual([]);
    expect(await upgraded.getMyRole()).toEqual([{ admin: null }]);
    upgraded.setPrincipal(member);
    expect(await upgraded.getMyRole()).toEqual([{ admin: null }]);
    const tournament = await upgraded.createTournament(
      tournamentInput({ title: "First night after migration" }),
    );
    expect(tournament.id).toBe(0n);
    expect((await upgraded.getTournament(tournament.id))[0]?.title).toBe(
      "First night after migration",
    );
    expect((await upgraded.getTournamentState(tournament.id))[0]).toMatchObject(
      {
        elimination: { singleElimination: null },
        started: false,
        players: [],
        matches: [],
        championId: [],
      },
    );
  }, 30_000);
});

beforeEach(() => {
  actor?.setPrincipal(owner);
});

afterAll(async () => {
  await pic?.tearDown();
});

describe("ChillPong users and tournaments", () => {
  it("offers public directory reads and returns no role for anonymous or unregistered callers", async () => {
    actor.setPrincipal(anonymous);
    expect(await actor.getMyRole()).toEqual([]);
    expect(await actor.listUsers()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "Owner",
          role: [{ admin: null }],
        }),
        expect.objectContaining({ displayName: "Member", role: [] }),
      ]),
    );
    expect((await actor.getUser(member))[0]?.username).toBe("member");
    expect((await actor.getUserByUsername("member"))[0]?.id.toText()).toBe(
      member.toText(),
    );
    expect(
      await actor.getUser(createIdentity("missing-user").getPrincipal()),
    ).toEqual([]);
    expect(await actor.getUserByUsername("missing-user")).toEqual([]);
    actor.setPrincipal(createIdentity("unregistered-caller").getPrincipal());
    expect(await actor.getMyRole()).toEqual([]);
  });

  it.each([
    { name: "anonymous", principal: anonymous },
    { name: "ordinary member", principal: member },
  ])(
    "rejects every user and tournament mutation from an $name",
    async ({ principal }) => {
      const tournament = await actor.createTournament(tournamentInput());
      const newId = createIdentity(
        `denied-${principal.toText()}`,
      ).getPrincipal();
      actor.setPrincipal(principal);
      await expect(actor.createUser(newId, userInput())).rejects.toThrow(
        /Unauthorized/,
      );
      await expect(actor.updateUser(member, userInput())).rejects.toThrow(
        /Unauthorized/,
      );
      await expect(actor.createTournament(tournamentInput())).rejects.toThrow(
        /Unauthorized/,
      );
      await expect(
        actor.updateTournament(tournament.id, tournamentInput()),
      ).rejects.toThrow(/Unauthorized/);
      await expect(actor.listUsersWithRoles()).rejects.toThrow(/Unauthorized/);
      expect(await actor.getUser(newId)).toEqual([]);
      expect((await actor.getUser(member))[0]?.displayName).toBe("Member");
      expect((await actor.getTournament(tournament.id))[0]?.title).toBe(
        "Warehouse Cup",
      );
    },
  );

  it("normalizes usernames, updates their lookup, and preserves an existing admin role", async () => {
    const principal = createIdentity("editable-user").getPrincipal();
    const created = await actor.createUser(
      principal,
      userInput({
        displayName: "  Nino  ",
        username: "  NINO_EDIT  ",
        bio: ["  Plays doubles  "],
      }),
    );
    expect(created.displayName).toBe("Nino");
    expect(created.username).toBe("nino_edit");
    expect(created.bio).toEqual(["Plays doubles"]);
    expect(created.role).toEqual([]);
    await actor.grantAdminRole(principal);

    const updated = await actor.updateUser(
      principal,
      userInput({
        displayName: "Nino B",
        username: "nino-b",
        bio: [],
      }),
    );
    expect(updated.id.toText()).toBe(principal.toText());
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.role).toEqual([{ admin: null }]);
    expect(updated.bio).toEqual([]);
    expect(await actor.getUserByUsername("nino_edit")).toEqual([]);
    expect((await actor.getUserByUsername("nino-b"))[0]?.displayName).toBe(
      "Nino B",
    );
    actor.setPrincipal(principal);
    expect(await actor.getMyRole()).toEqual([{ admin: null }]);
    actor.setPrincipal(owner);
    await actor.revokeAdminRole(principal);
    actor.setPrincipal(principal);
    expect(await actor.getMyRole()).toEqual([]);
  });

  it("rejects duplicate usernames atomically when creating or renaming a member", async () => {
    const principal = createIdentity("duplicate-user").getPrincipal();
    await expect(
      actor.createUser(principal, userInput({ username: "  MEMBER  " })),
    ).rejects.toThrow(/Username already taken/);
    expect(await actor.getUser(principal)).toEqual([]);

    await actor.createUser(
      principal,
      userInput({ username: "original-handle" }),
    );
    await expect(
      actor.updateUser(principal, userInput({ username: "member" })),
    ).rejects.toThrow(/Username already taken/);
    expect(
      (await actor.getUserByUsername("original-handle"))[0]?.id.toText(),
    ).toBe(principal.toText());
    expect((await actor.getUserByUsername("member"))[0]?.id.toText()).toBe(
      member.toText(),
    );
    await expect(
      actor.createUser(principal, userInput({ username: "another-handle" })),
    ).rejects.toThrow(/User already exists/);
  });

  it.each([
    { input: userInput({ displayName: " " }), error: /Display name/ },
    { input: userInput({ username: "ab" }), error: /Username must be/ },
    {
      input: userInput({ username: "not a handle" }),
      error: /Username may only/,
    },
    { input: userInput({ bio: ["x".repeat(501)] }), error: /Bio must be/ },
  ])(
    "validates user input before storing it ($error)",
    async ({ input, error }) => {
      const principal = createIdentity(
        `invalid-user-${String(error)}`,
      ).getPrincipal();
      await expect(actor.createUser(principal, input)).rejects.toThrow(error);
      expect(await actor.getUser(principal)).toEqual([]);
    },
  );

  it("rejects anonymous user identities and missing members", async () => {
    await expect(actor.createUser(anonymous, userInput())).rejects.toThrow(
      /Anonymous/,
    );
    await expect(
      actor.updateUser(
        createIdentity("unknown-edit").getPrincipal(),
        userInput(),
      ),
    ).rejects.toThrow(/User not found/);
  });

  it("creates, publicly reads and edits a tournament while retaining its identity and creation time", async () => {
    const input = tournamentInput({
      title: "  Friday Rally  ",
      venue: "  Basement Bar  ",
    });
    const created = await actor.createTournament(input);
    expect(created).toMatchObject({
      ...input,
      title: "Friday Rally",
      venue: "Basement Bar",
    });
    actor.setPrincipal(anonymous);
    expect(await actor.getTournaments()).toContainEqual(created);
    expect(await actor.getTournament(created.id)).toEqual([created]);
    expect(await actor.getTournament(999_999n)).toEqual([]);
    actor.setPrincipal(owner);
    const updated = await actor.updateTournament(
      created.id,
      tournamentInput({
        title: "Friday Doubles",
        format: { doubles: null },
        capacity: 24n,
        status: { live: null },
      }),
    );
    expect(updated).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      title: "Friday Doubles",
      format: { doubles: null },
      capacity: 24n,
      status: { live: null },
    });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(await actor.getTournament(created.id)).toEqual([updated]);
  });

  it.each([
    { input: tournamentInput({ title: " " }), error: /title/i },
    { input: tournamentInput({ venue: " " }), error: /venue/i },
    {
      input: tournamentInput({ description: "x".repeat(2001) }),
      error: /description/i,
    },
    { input: tournamentInput({ startsAt: 0n }), error: /start/i },
    {
      input: tournamentInput({ capacity: 1n }),
      error: /capacity|expected players/i,
    },
    {
      input: tournamentInput({ capacity: 0n }),
      error: /capacity|expected players/i,
    },
  ])(
    "validates tournament input before changing the board ($error)",
    async ({ input, error }) => {
      const before = await actor.getTournaments();
      await expect(actor.createTournament(input)).rejects.toThrow(error);
      expect(await actor.getTournaments()).toEqual(before);
      await expect(
        actor.updateTournament(before[0]!.id, input),
      ).rejects.toThrow(error);
      expect(await actor.getTournaments()).toEqual(before);
    },
  );

  it("keeps public and admin role reads aligned with generic package role assignments", async () => {
    await actor.grantAdminRole(member);
    try {
      await actor.assignCallerUserRole(member, { user: null });
      actor.setPrincipal(member);
      expect(await actor.getMyRole()).toEqual([]);
      expect((await actor.getUser(member))[0]?.role).toEqual([]);
      expect((await actor.getUserByUsername("member"))[0]?.role).toEqual([]);
      expect(
        (await actor.listUsers()).find(
          (user) => user.id.toText() === member.toText(),
        )?.role,
      ).toEqual([]);
      await expect(actor.createTournament(tournamentInput())).rejects.toThrow(
        /Unauthorized/,
      );
      actor.setPrincipal(owner);
      expect(
        (await actor.listUsersWithRoles()).find(
          (user) => user.id.toText() === member.toText(),
        )?.role,
      ).toEqual([]);

      await actor.assignCallerUserRole(member, { admin: null });
      actor.setPrincipal(member);
      expect(await actor.getMyRole()).toEqual([{ admin: null }]);
      expect((await actor.getUser(member))[0]?.role).toEqual([{ admin: null }]);
      expect(
        (await actor.listUsers()).find(
          (user) => user.id.toText() === member.toText(),
        )?.role,
      ).toEqual([{ admin: null }]);
      actor.setPrincipal(owner);
      expect(
        (await actor.listUsersWithRoles()).find(
          (user) => user.id.toText() === member.toText(),
        )?.role,
      ).toEqual([{ admin: null }]);
    } finally {
      actor.setPrincipal(owner);
      await actor.assignCallerUserRole(member, { user: null });
    }
  });

  it("prevents member role escalation and keeps the original owner admin on repeated setup", async () => {
    actor.setPrincipal(member);
    await expect(actor.grantAdminRole(member)).rejects.toThrow(/Unauthorized/);
    await expect(actor.revokeAdminRole(owner)).rejects.toThrow(
      /Unauthorized|owner/i,
    );
    await expect(
      actor.assignCallerUserRole(member, { admin: null }),
    ).rejects.toThrow(/Unauthorized/);
    await actor.bootstrapOwner();
    expect(await actor.getMyRole()).toEqual([]);

    actor.setPrincipal(owner);
    // The owner setup must repair drift in the package-level role too, even
    // while the app's User.role still records this identity as admin.
    await actor.assignCallerUserRole(owner, { user: null });
    expect(await actor.isCallerAdmin()).toBe(false);
    await actor.bootstrapOwner();
    expect(await actor.isCallerAdmin()).toBe(true);
    await actor.bootstrapOwner();
    await actor._initialize_access_control();
    await actor.bootstrapOwner();
    expect(await actor.getMyRole()).toEqual([{ admin: null }]);
    expect((await actor.getUser(owner))[0]?.role).toEqual([{ admin: null }]);
    await expect(actor.revokeAdminRole(owner)).rejects.toThrow(/owner/i);
    expect(await actor.listUsersWithRoles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: "owner", role: [{ admin: null }] }),
        expect.objectContaining({ username: "member", role: [] }),
      ]),
    );
  });

  it("retains users, tournaments and owner access across a canister upgrade", async () => {
    const users = await actor.listUsers();
    const tournaments = await actor.getTournaments();
    // This checks persistence of the current schema. Legacy schema replay is
    // handled separately by the lane runner when a baseline artifact is present.
    await pic!.upgradeCanister({
      canisterId,
      wasm: BACKEND_WASM,
      arg: new Uint8Array(),
      upgradeModeOptions: {
        skip_pre_upgrade: [],
        wasm_memory_persistence: [{ keep: null }],
      },
    });
    expect(await actor.listUsers()).toEqual(users);
    expect(await actor.getTournaments()).toEqual(tournaments);
    await actor.bootstrapOwner();
    expect(await actor.getMyRole()).toEqual([{ admin: null }]);
    expect((await actor.getUser(owner))[0]?.role).toEqual([{ admin: null }]);
    const tournament = await actor.createTournament(
      tournamentInput({ title: "After upgrade" }),
    );
    expect(tournament.id).toBeGreaterThan(
      tournaments.reduce((max, item) => (item.id > max ? item.id : max), 0n),
    );
  });
});
