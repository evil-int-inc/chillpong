import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TournamentInput, _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const owner = createIdentity("status-owner").getPrincipal();
const member = createIdentity("status-member").getPrincipal();
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const anonymous: typeof owner = picRequire("@icp-sdk/core/principal").Principal.anonymous();
let pic: PocketIc;
let actor: Actor<_SERVICE>;
function input(status: TournamentInput["status"] = { upcoming: null }): TournamentInput {
  return { title: "Status regression", description: "", venue: "ChillPong", startsAt: 1n,
    format: { singles: null }, capacity: 8n, status };
}
async function room(count = 4) {
  const tournament = await actor.createTournament(input());
  for (let index = 0; index < count; index++) {
    await actor.applyTournamentCommand(tournament.id, { addPlayer: { name: `Player ${index + 1}`, skillLevel: 2n } });
  }
  const generated = await actor.applyTournamentCommand(tournament.id, { generateBracket: null });
  const matchId = generated.nextMatches[0]!;
  const state = await actor.applyTournamentCommand(tournament.id, { recordResult: { matchId, scoreA: 11n, scoreB: 5n } });
  return { tournament, state, matchId };
}
async function expectStatus(id: bigint, status: TournamentInput["status"]) {
  expect((await actor.getTournament(id))[0]!.status).toEqual(status);
  expect((await actor.getTournaments()).find((entry) => entry.id === id)!.status).toEqual(status);
}
beforeAll(async () => {
  pic = await PocketIc.create(process.env.POCKET_IC_URL!);
  ({ actor } = await pic.setupCanister<_SERVICE>({ idlFactory, wasm: process.env.BACKEND_WASM! }));
  actor.setPrincipal(owner);
  await actor._initialize_access_control();
  await actor.bootstrapOwner();
  actor.setPrincipal(member);
  await actor._initialize_access_control();
});
beforeEach(() => actor.setPrincipal(owner));
afterAll(async () => pic?.tearDown());

describe("tournament status", () => {
  it("saves an admin's completed status for a started tournament without requiring a champion", async () => {
    const { tournament, state } = await room();
    expect(state.started).toBe(true);
    expect(state.championId).toEqual([]);
    await expectStatus(tournament.id, { live: null });
    const updated = await actor.updateTournament(tournament.id, input({ completed: null }));
    expect(updated).toMatchObject({ id: tournament.id, createdAt: tournament.createdAt, status: { completed: null } });
    await expectStatus(tournament.id, { completed: null });
    expect(await actor.getTournamentState(tournament.id)).toEqual([state]);
  });

  it("retains manual completion through score corrections, setup edits and undo until explicitly reopened", async () => {
    const { tournament, matchId } = await room();
    await actor.updateTournament(tournament.id, input({ completed: null }));
    await actor.applyTournamentCommand(tournament.id, { recordResult: { matchId, scoreA: 11n, scoreB: 7n } });
    await expectStatus(tournament.id, { completed: null });
    await actor.applyTournamentCommand(tournament.id, { configure: { elimination: { singleElimination: null }, tableCount: 4n } });
    await actor.applyTournamentCommand(tournament.id, { undo: null });
    await expectStatus(tournament.id, { completed: null });
    await actor.updateTournament(tournament.id, { ...input({ completed: null }), title: "Updated details" });
    await expectStatus(tournament.id, { completed: null });
    await actor.updateTournament(tournament.id, input({ live: null }));
    await actor.applyTournamentCommand(tournament.id, { recordResult: { matchId, scoreA: 11n, scoreB: 9n } });
    await expectStatus(tournament.id, { live: null });
  });

  it("keeps a manually completed unstarted tournament completed after player edits", async () => {
    const tournament = await actor.createTournament(input({ completed: null }));
    const registered = await actor.applyTournamentCommand(tournament.id, { addPlayer: { name: "Late correction", skillLevel: 2n } });
    expect(registered.started).toBe(false);
    await expectStatus(tournament.id, { completed: null });
  });

  it("still automatically completes a finished draw and reopens it when the final is undone", async () => {
    const { tournament, state } = await room(2);
    expect(state.championId).toHaveLength(1);
    await expectStatus(tournament.id, { completed: null });
    await actor.updateTournament(tournament.id, { ...input({ completed: null }), title: "Final results" });
    const undone = await actor.applyTournamentCommand(tournament.id, { undo: null });
    expect(undone.championId).toEqual([]);
    await expectStatus(tournament.id, { live: null });
  });

  it.each([member, anonymous])("keeps status updates admin-only (%s)", async (principal) => {
    const { tournament, state } = await room();
    const before = await actor.getTournament(tournament.id);
    actor.setPrincipal(principal);
    await expect(actor.updateTournament(tournament.id, input({ completed: null }))).rejects.toThrow(/Unauthorized/);
    expect(await actor.getTournament(tournament.id)).toEqual(before);
    expect(await actor.getTournamentState(tournament.id)).toEqual([state]);
  });
});
