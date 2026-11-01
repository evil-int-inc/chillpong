import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TournamentState, _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

let pic: PocketIc;
let actor: Actor<_SERVICE>;
beforeAll(async () => {
  pic = await PocketIc.create(process.env.POCKET_IC_URL!);
  ({ actor } = await pic.setupCanister<_SERVICE>({ idlFactory, wasm: process.env.BACKEND_WASM! }));
  actor.setPrincipal(createIdentity("late-registration-regression").getPrincipal());
  await actor._initialize_access_control();
  await actor.bootstrapOwner();
});
afterAll(async () => pic?.tearDown());

describe("late registration after fifty players", () => {
  it.each(["new", "existing"] as const)("registers a 53rd %s player, rejects a locked BYE, and places them safely without losing scores", async (source) => {
    const tournament = await actor.createTournament({ title: "Running 49-player draw", description: "", venue: "ChillPong", startsAt: 1n,
      format: { singles: null }, capacity: 40n, status: { live: null } });
    const id = tournament.id;
    await actor.applyTournamentCommand(id, { configure: { elimination: { doubleElimination: null }, tableCount: 3n } });
    for (let index = 0; index < 49; index++) {
      await actor.applyTournamentCommand(id, { addPlayer: { name: `Entrant ${index + 1}`, skillLevel: 2n } });
    }
    let state = await actor.applyTournamentCommand(id, { generateBracket: null });
    const ready = (item: TournamentState["matches"][number]) => "ready" in item.status;
    const lockedBye = state.matches.find((bye) => "winners" in bye.bracket && bye.round === 1n && "bye" in bye.status &&
      state.matches.some((next) => ready(next) && [next.sourceA, next.sourceB].some((slot) => "winner" in slot && slot.winner === bye.id)))!;
    expect(lockedBye).toBeDefined();
    const following = state.matches.find((next) => ready(next) && [next.sourceA, next.sourceB].some((slot) => "winner" in slot && slot.winner === lockedBye.id))!;
    state = await actor.applyTournamentCommand(id, { recordResult: { matchId: following.id, scoreA: 11n, scoreB: 6n } });
    const scored = state.matches.find((match) => match.id === following.id)!;
    const activeId = state.matches.find((match) => "winners" in match.bracket && ready(match))!.id;
    await actor.applyTournamentCommand(id, { startMatch: activeId });
    for (let index = 0; index < 3; index++) {
      state = await actor.applyTournamentCommand(id, { addPlayer: { name: `Late player ${index + 1}`, skillLevel: 2n } });
      const target = state.matches.find((match) => "winners" in match.bracket && ready(match))!;
      state = await actor.applyTournamentCommand(id, { placePlayer: { playerId: state.players.at(-1)!.id, matchId: target.id, slot: { a: null } } });
    }
    expect(state.players).toHaveLength(52);
    const active = state.matches.find((match) => match.id === activeId)!;
    if (source === "new") {
      state = await actor.applyTournamentCommand(id, { addPlayer: { name: "Last arrival", skillLevel: 3n } });
    } else {
      const shared = await actor.createPlayer({ name: "Last arrival", skillLevel: 3n });
      state = await actor.applyTournamentCommand(id, { addExistingPlayer: { globalPlayerId: shared.id } });
    }
    expect(state.players).toHaveLength(53);
    const late = state.players.at(-1)!;
    expect(late.registrationNumber).toBe(53n);
    expect(state.waitingQueue).toContain(late.id);
    const registered = state;
    const directory = await actor.listPlayers();
    await expect(actor.applyTournamentCommand(id, { placePlayer: { playerId: late.id, matchId: lockedBye.id, slot: { a: null } } }))
      .rejects.toThrow(/Reset completed or playing dependent matches/);
    expect(await actor.getTournamentState(id)).toEqual([registered]);
    expect(await actor.listPlayers()).toEqual(directory);
    const target = state.matches.find((match) => "winners" in match.bracket && ready(match))!;
    state = await actor.applyTournamentCommand(id, { placePlayer: { playerId: late.id, matchId: target.id, slot: { a: null } } });
    expect(state.matches.some((match) => [match.sourceA, match.sourceB].some((slot) => "player" in slot && slot.player === late.id))).toBe(true);
    expect(state.players).toHaveLength(53);
    expect(state.matches.find((match) => match.id === following.id)).toEqual(scored);
    expect(state.matches.find((match) => match.id === activeId)).toEqual(active);
    expect(state.players.at(-1)).toMatchObject({ id: late.id, registrationNumber: late.registrationNumber, registeredAt: late.registeredAt });
  });
});
