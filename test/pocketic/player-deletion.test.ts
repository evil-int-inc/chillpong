import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const owner = createIdentity("delete-player-owner").getPrincipal();
const member = createIdentity("delete-player-member").getPrincipal();
const unregistered = createIdentity("delete-player-unregistered").getPrincipal();
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const anonymous: typeof owner = picRequire("@icp-sdk/core/principal").Principal.anonymous();
let pic: PocketIc;
let actor: Actor<_SERVICE>;
let canisterId: typeof owner;

beforeAll(async () => {
  pic = await PocketIc.create(process.env.POCKET_IC_URL!);
  ({ actor, canisterId } = await pic.setupCanister<_SERVICE>({ idlFactory, wasm: process.env.BACKEND_WASM! }));
  actor.setPrincipal(owner);
  await actor._initialize_access_control();
  await actor.bootstrapOwner();
  actor.setPrincipal(member);
  await actor._initialize_access_control();
  await actor.saveCallerProfile({ displayName: "Member name", username: "member_username" });
});
beforeEach(() => actor.setPrincipal(owner));
afterAll(async () => pic?.tearDown());

describe("player deletion", () => {
  it.each([member, anonymous, unregistered])("rejects a non-admin caller (%s) without mutating the directory", async (principal) => {
    const player = await actor.createPlayer({ name: "Protected player", skillLevel: 2n });
    const before = await actor.listPlayers();
    actor.setPrincipal(principal);
    expect(await actor.deletePlayer(player.id)).toEqual({ err: { notAuthorized: null } });
    expect(await actor.deletePlayer(999_999n)).toEqual({ err: { notAuthorized: null } });
    expect(await actor.listPlayers()).toEqual(before);
  });

  it("reports missing and repeated deletions without changing other players", async () => {
    const player = await actor.createPlayer({ name: "Delete once", skillLevel: 1n });
    expect(await actor.deletePlayer(player.id)).toEqual({ ok: null });
    const retained = await actor.listPlayers();
    expect(await actor.deletePlayer(player.id)).toEqual({ err: { notFound: null } });
    expect(await actor.deletePlayer(999_999n)).toEqual({ err: { notFound: null } });
    expect(await actor.listPlayers()).toEqual(retained);
    const next = await actor.createPlayer({ name: "New identity", skillLevel: 1n });
    expect(next.id).toBeGreaterThan(player.id);
  });

  it("releases the member link while retaining the account, completed results, registration numbers and history", async () => {
    const player = await actor.createPlayer({ name: "Linked player", skillLevel: 3n });
    await actor.linkPlayerToUser(player.id, member);
    const tournament = await actor.createTournament({
      title: "Keep completed results", description: "", venue: "ChillPong", startsAt: 1n,
      format: { singles: null }, capacity: 8n, status: { upcoming: null },
    });
    await actor.applyTournamentCommand(tournament.id, { addExistingPlayer: { globalPlayerId: player.id } });
    await actor.applyTournamentCommand(tournament.id, { addPlayer: { name: "Opponent", skillLevel: 2n } });
    const generated = await actor.applyTournamentCommand(tournament.id, { generateBracket: null });
    const completed = await actor.applyTournamentCommand(tournament.id, {
      recordResult: { matchId: generated.nextMatches[0]!, scoreA: 11n, scoreB: 8n },
    });
    const accounts = await actor.listUsers();
    const memberships = await actor.listUsersWithRoles();
    const rooms = await actor.getTournaments();
    const before = await actor.listPlayers();
    expect(await actor.deletePlayer(player.id)).toEqual({ ok: null });
    expect(await actor.listPlayers()).toEqual(before.filter((entry) => entry.id !== player.id));
    expect(await actor.listUsers()).toEqual(accounts);
    expect(await actor.listUsersWithRoles()).toEqual(memberships);
    expect(await actor.getTournaments()).toEqual(rooms);
    expect((await actor.getTournamentState(tournament.id))[0]).toEqual({
      ...completed,
      players: completed.players.map((entry) => entry.globalPlayerId[0] === player.id
        ? { ...entry, globalPlayerId: [], userId: [], avatarUrl: [] } : entry),
    });
    // Undoing a result restores match state, never a deleted shared identity.
    const undone = await actor.applyTournamentCommand(tournament.id, { undo: null });
    expect(undone.players[0]).toMatchObject({ name: player.name, globalPlayerId: [], userId: [], avatarUrl: [] });
    expect((await actor.listPlayers()).some((entry) => entry.id === player.id)).toBe(false);
    await expect(actor.updatePlayer(player.id, { name: "No resurrection", skillLevel: 2n })).rejects.toThrow(/Player not found/);
    await expect(actor.applyTournamentCommand(tournament.id, { addExistingPlayer: { globalPlayerId: player.id } })).rejects.toThrow(/Player not found/);
    const replacement = await actor.createPlayer({ name: "Replacement identity", skillLevel: 4n });
    expect((await actor.linkPlayerToUser(replacement.id, member)).userId[0]?.toText()).toBe(member.toText());
    expect((await actor.getUser(member))[0]!.username).toBe("member_username");
  });

  it("keeps deletions and detached tournament registrations across an upgrade", async () => {
    const players = await actor.listPlayers();
    const users = await actor.listUsers();
    const rooms = await actor.getTournaments();
    const states = await Promise.all(rooms.map((room) => actor.getTournamentState(room.id)));
    await pic.upgradeCanister({
      canisterId, wasm: process.env.BACKEND_WASM!,
      upgradeModeOptions: { skip_pre_upgrade: [], wasm_memory_persistence: [{ keep: null }] },
    });
    actor = pic.createActor<_SERVICE>(idlFactory, canisterId);
    actor.setPrincipal(owner);
    expect(await actor.listPlayers()).toEqual(players);
    expect(await actor.listUsers()).toEqual(users);
    expect(await Promise.all(rooms.map((room) => actor.getTournamentState(room.id)))).toEqual(states);
  });
});
