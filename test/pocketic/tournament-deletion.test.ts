import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
	TournamentInput,
	_SERVICE,
} from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const owner = createIdentity("delete-tournament-owner").getPrincipal();
const member = createIdentity("delete-tournament-member").getPrincipal();
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const anonymous: typeof owner = picRequire(
	"@icp-sdk/core/principal",
).Principal.anonymous();
let pic: PocketIc;
let actor: Actor<_SERVICE>;
function input(title: string): TournamentInput {
	return {
		title,
		description: "",
		venue: "ChillPong",
		startsAt: 1n,
		capacity: 8n,
		format: { singles: null },
		status: { upcoming: null },
	};
}
beforeAll(async () => {
	pic = await PocketIc.create(process.env.POCKET_IC_URL!);
	({ actor } = await pic.setupCanister<_SERVICE>({
		idlFactory,
		wasm: process.env.BACKEND_WASM!,
	}));
	actor.setPrincipal(owner);
	await actor._initialize_access_control();
	await actor.bootstrapOwner();
	await actor.saveCallerProfile({ displayName: "Owner", username: "owner" });
	actor.setPrincipal(member);
	await actor._initialize_access_control();
	await actor.saveCallerProfile({ displayName: "Member", username: "member" });
});
beforeEach(() => actor.setPrincipal(owner));
afterAll(async () => pic?.tearDown());

describe("tournament deletion", () => {
	it.each(["anonymous", "member"])(
		"rejects deletion by an %s caller without changing the tournament",
		async (caller) => {
			const tournament = await actor.createTournament(
				input(`Protected ${caller}`),
			);
			const before = await actor.applyTournamentCommand(tournament.id, {
				addPlayer: { name: "Still registered", skillLevel: 2n },
			});
			const tournamentBefore = await actor.getTournament(tournament.id);
			actor.setPrincipal(caller === "anonymous" ? anonymous : member);
			expect(await actor.deleteTournament(tournament.id)).toEqual({
				err: { notAuthorized: null },
			});
			expect(await actor.getTournament(tournament.id)).toEqual(
				tournamentBefore,
			);
			expect(await actor.getTournamentState(tournament.id)).toEqual([before]);
		},
	);

	it("deletes a played tournament while preserving shared players, member links, and other tournaments", async () => {
		const removed = await actor.createTournament(input("Delete this room"));
		const retained = await actor.createTournament(input("Keep this room"));
		const reusable = await actor.createPlayer({
			name: "Shared player",
			skillLevel: 3n,
		});
		await actor.linkPlayerToUser(reusable.id, member);
		await actor.applyTournamentCommand(removed.id, {
			addExistingPlayer: { globalPlayerId: reusable.id },
		});
		await actor.applyTournamentCommand(removed.id, {
			addPlayer: { name: "Opponent", skillLevel: 2n },
		});
		let state = await actor.applyTournamentCommand(removed.id, {
			generateBracket: null,
		});
		const ready = state.matches.find((match) => "ready" in match.status)!;
		state = await actor.applyTournamentCommand(removed.id, {
			recordResult: { matchId: ready.id, scoreA: 11n, scoreB: 5n },
		});
		expect(state.history.length).toBeGreaterThan(0);
		expect(state.matches.some((match) => "completed" in match.status)).toBe(
			true,
		);
		const retainedState = await actor.applyTournamentCommand(retained.id, {
			addExistingPlayer: { globalPlayerId: reusable.id },
		});
		const retainedTournament = await actor.getTournament(retained.id);
		const players = await actor.listPlayers();
		const profiles = await actor.listUsers();
		const accounts = await actor.listUsersWithRoles();

		expect(await actor.deleteTournament(removed.id)).toEqual({ ok: null });
		expect(await actor.getTournament(removed.id)).toEqual([]);
		expect(await actor.getTournamentState(removed.id)).toEqual([]);
		expect(
			(await actor.getTournaments()).some((entry) => entry.id === removed.id),
		).toBe(false);
		await expect(
			actor.applyTournamentCommand(removed.id, { undo: null }),
		).rejects.toThrow(/Tournament not found/);
		await expect(
			actor.updateTournament(removed.id, input("Restore")),
		).rejects.toThrow(/Tournament not found/);
		expect(await actor.getTournament(retained.id)).toEqual(retainedTournament);
		expect(await actor.getTournamentState(retained.id)).toEqual([
			retainedState,
		]);
		expect(await actor.listPlayers()).toEqual(players);
		expect(await actor.listUsers()).toEqual(profiles);
		expect(await actor.listUsersWithRoles()).toEqual(accounts);
		expect(
			(await actor.listPlayers()).find((entry) => entry.id === reusable.id)
				?.userId,
		).toEqual([member]);
		const next = await actor.createTournament(input("A different room"));
		expect(next.id).toBeGreaterThan(retained.id);
		expect(next.id).not.toBe(removed.id);
	});

	it("deletes an empty tournament and reports an already deleted or unknown ID without affecting other rooms", async () => {
		const tournament = await actor.createTournament(input("Empty room"));
		expect(await actor.deleteTournament(tournament.id)).toEqual({ ok: null });
		const remaining = await actor.getTournaments();
		expect(await actor.deleteTournament(tournament.id)).toEqual({
			err: { notFound: null },
		});
		expect(await actor.deleteTournament(999_999n)).toEqual({
			err: { notFound: null },
		});
		expect(await actor.getTournaments()).toEqual(remaining);
	});
});
