import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
	TournamentInput,
	_SERVICE,
} from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const owner = createIdentity("shared-players-owner").getPrincipal();
const member = createIdentity("shared-players-member").getPrincipal();
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const anonymous: typeof owner = picRequire(
	"@icp-sdk/core/principal",
).Principal.anonymous();
let pic: PocketIc;
let actor: Actor<_SERVICE>;
let canisterId: typeof owner;

function tournamentInput(title: string): TournamentInput {
	return {
		title,
		description: "",
		venue: "ChillPong",
		startsAt: 1n,
		format: { singles: null },
		capacity: 8n,
		status: { upcoming: null },
	};
}

beforeAll(async () => {
	pic = await PocketIc.create(process.env.POCKET_IC_URL!);
	({ actor, canisterId } = await pic.setupCanister<_SERVICE>({
		idlFactory,
		wasm: process.env.BACKEND_WASM!,
	}));
	actor.setPrincipal(owner);
	await actor._initialize_access_control();
	await actor.bootstrapOwner();
	actor.setPrincipal(member);
	await actor._initialize_access_control();
});
beforeEach(() => actor.setPrincipal(owner));
afterAll(async () => pic?.tearDown());

describe("shared club players", () => {
	it("makes newly registered players reusable across rooms without sharing bracket or FIFO IDs", async () => {
		const first = await actor.createTournament(tournamentInput("First room"));
		let state = await actor.applyTournamentCommand(first.id, {
			addPlayer: { name: "  Reusable Player  ", skillLevel: 3n },
		});
		const original = state.players[0]!;
		expect(original.globalPlayerId).toHaveLength(1);
		const global = (await actor.listPlayers()).find(
			(item) => item.id === original.globalPlayerId[0],
		)!;
		expect(global).toMatchObject({
			name: "Reusable Player",
			skillLevel: 3n,
			userId: [],
		});
		const second = await actor.createTournament(tournamentInput("Second room"));
		await actor.applyTournamentCommand(second.id, {
			addPlayer: { name: "Someone else", skillLevel: 1n },
		});
		const reused = await actor.applyTournamentCommand(second.id, {
			addExistingPlayer: { globalPlayerId: global.id },
		});
		expect(reused.players[1]).toMatchObject({
			id: 2n,
			globalPlayerId: [global.id],
			registrationNumber: 2n,
			name: global.name,
		});
		expect((await actor.getTournamentState(first.id))[0]).toEqual(state);
		await expect(
			actor.applyTournamentCommand(second.id, {
				addExistingPlayer: { globalPlayerId: global.id },
			}),
		).rejects.toThrow(/already registered/);
		state = await actor.applyTournamentCommand(second.id, {
			removePlayer: { playerId: reused.players[1]!.id, confirmed: true },
		});
		await expect(
			actor.applyTournamentCommand(second.id, {
				addExistingPlayer: { globalPlayerId: global.id },
			}),
		).rejects.toThrow(/already registered/);
		expect((await actor.getTournamentState(second.id))[0]).toEqual(state);
	});

	it("undoes registration without deleting the club identity and never reuses local registration IDs", async () => {
		const room = await actor.createTournament(tournamentInput("Undo room"));
		const first = await actor.applyTournamentCommand(room.id, {
			addPlayer: { name: "Keep in directory", skillLevel: 2n },
		});
		const globalId = first.players[0]!.globalPlayerId[0]!;
		const undone = await actor.applyTournamentCommand(room.id, { undo: null });
		expect(undone.players).toEqual([]);
		expect(
			(await actor.listPlayers()).some((player) => player.id === globalId),
		).toBe(true);
		const again = await actor.applyTournamentCommand(room.id, {
			addExistingPlayer: { globalPlayerId: globalId },
		});
		expect(again.players[0]).toMatchObject({
			id: 2n,
			registrationNumber: 2n,
			globalPlayerId: [globalId],
		});
	});

	it("preserves tournament names, results and history when the directory changes", async () => {
		const room = await actor.createTournament(
			tournamentInput("Recorded names"),
		);
		const player = await actor.createPlayer({
			name: "Original club name",
			skillLevel: 2n,
		});
		await actor.applyTournamentCommand(room.id, {
			addExistingPlayer: { globalPlayerId: player.id },
		});
		await actor.applyTournamentCommand(room.id, {
			addPlayer: { name: "Opponent", skillLevel: 3n },
		});
		const generated = await actor.applyTournamentCommand(room.id, {
			generateBracket: null,
		});
		const finished = await actor.applyTournamentCommand(room.id, {
			recordResult: {
				matchId: generated.nextMatches[0]!,
				scoreA: 11n,
				scoreB: 7n,
			},
		});
		await actor.updatePlayer(player.id, {
			name: "Future club name",
			skillLevel: 5n,
		});
		expect((await actor.getTournamentState(room.id))[0]).toEqual(finished);
		const edited = await actor.applyTournamentCommand(room.id, {
			editPlayer: {
				playerId: finished.players[0]!.id,
				name: "Event-only name",
				skillLevel: 4n,
			},
		});
		expect(edited.players[0]!.name).toBe("Event-only name");
		expect(
			(await actor.listPlayers()).find((item) => item.id === player.id)!.name,
		).toBe("Future club name");
		expect(
			(await actor.applyTournamentCommand(room.id, { undo: null })).players[0]!
				.name,
		).toBe("Original club name");
		const later = await actor.createTournament(tournamentInput("Later room"));
		const registered = await actor.applyTournamentCommand(later.id, {
			addExistingPlayer: { globalPlayerId: player.id },
		});
		expect(registered.players[0]).toMatchObject({
			name: "Future club name",
			skillLevel: 5n,
		});
	});

	it("links only authenticated members and replaces an existing name while preserving identity and metadata", async () => {
		actor.setPrincipal(member);
		const before = await actor.saveCallerProfile({
			displayName: "My chosen name",
			username: "linked_member",
		});
		actor.setPrincipal(owner);
		const player = await actor.createPlayer({
			name: "Paddle Name",
			skillLevel: 4n,
		});
		const linked = await actor.linkPlayerToUser(player.id, member);
		expect(linked.userId[0]!.toText()).toBe(member.toText());
		expect((await actor.getUser(member))[0]).toEqual({
			...before,
			displayName: "Paddle Name",
		});
		expect((await actor.getUser(member))[0]!.role).toEqual([]);
		await actor.updatePlayer(player.id, {
			name: "Updated paddle name",
			skillLevel: 5n,
		});
		expect((await actor.getUser(member))[0]!.displayName).toBe(
			"Updated paddle name",
		);
		expect((await actor.unlinkPlayerFromUser(player.id)).userId).toEqual([]);
		expect((await actor.getUser(member))[0]!.displayName).toBe(
			"Updated paddle name",
		);
	});

	it("creates an optional member profile when linking a signed-in member without one", async () => {
		const profileless = createIdentity(
			"profileless-player-link",
		).getPrincipal();
		actor.setPrincipal(profileless);
		await actor._initialize_access_control();
		expect(await actor.getCallerProfile()).toEqual([]);
		actor.setPrincipal(owner);
		const player = await actor.createPlayer({
			name: "Profileless player",
			skillLevel: 1n,
		});
		await actor.linkPlayerToUser(player.id, profileless);
		expect((await actor.getUser(profileless))[0]).toMatchObject({
			displayName: player.name,
			username: "",
			bio: [],
			role: [],
		});
		const unregistered = createIdentity(
			"never-authed-player-link",
		).getPrincipal();
		await expect(
			actor.linkPlayerToUser(player.id, unregistered),
		).rejects.toThrow(/authenticated account/);
	});

	it("rejects conflicting links atomically until an admin explicitly unlinks them", async () => {
		const firstMember = createIdentity(
			"first-unique-linked-member",
		).getPrincipal();
		const secondMember = createIdentity(
			"second-unique-linked-member",
		).getPrincipal();
		for (const principal of [firstMember, secondMember]) {
			actor.setPrincipal(principal);
			await actor._initialize_access_control();
		}
		actor.setPrincipal(owner);
		const first = await actor.createPlayer({
			name: "First identity",
			skillLevel: 1n,
		});
		const second = await actor.createPlayer({
			name: "Second identity",
			skillLevel: 2n,
		});
		await actor.linkPlayerToUser(first.id, firstMember);
		const directory = await actor.listPlayers();
		const profile = await actor.getUser(firstMember);
		await expect(
			actor.linkPlayerToUser(first.id, secondMember),
		).rejects.toThrow(/already linked/);
		await expect(
			actor.linkPlayerToUser(second.id, firstMember),
		).rejects.toThrow(/already linked/);
		expect(await actor.listPlayers()).toEqual(directory);
		expect(await actor.getUser(firstMember)).toEqual(profile);
		expect(await actor.getUser(secondMember)).toEqual([]);
		await actor.unlinkPlayerFromUser(first.id);
		await actor.linkPlayerToUser(second.id, firstMember);
		expect((await actor.getUser(firstMember))[0]!.displayName).toBe(
			second.name,
		);
	});

	it.each([member, anonymous])(
		"keeps all global player mutations admin-only (%s)",
		async (principal) => {
			const player = await actor.createPlayer({
				name: "Permission target",
				skillLevel: 2n,
			});
			const before = await actor.listPlayers();
			actor.setPrincipal(principal);
			expect(await actor.listPlayers()).toEqual(before);
			await expect(
				actor.createPlayer({ name: "No access", skillLevel: 2n }),
			).rejects.toThrow(/Unauthorized/);
			await expect(
				actor.updatePlayer(player.id, { name: "No access", skillLevel: 2n }),
			).rejects.toThrow(/Unauthorized/);
			await expect(actor.linkPlayerToUser(player.id, member)).rejects.toThrow(
				/Unauthorized/,
			);
			await expect(actor.unlinkPlayerFromUser(player.id)).rejects.toThrow(
				/Unauthorized/,
			);
			expect(await actor.listPlayers()).toEqual(before);
		},
	);

	it("rolls back invalid registration without creating a global identity or consuming FIFO IDs", async () => {
		const room = await actor.createTournament(tournamentInput("Reject room"));
		const before = await actor.getTournamentState(room.id);
		const directory = await actor.listPlayers();
		await expect(
			actor.applyTournamentCommand(room.id, {
				addPlayer: { name: "", skillLevel: 2n },
			}),
		).rejects.toThrow(/Player name/);
		await expect(
			actor.applyTournamentCommand(room.id, {
				addExistingPlayer: { globalPlayerId: 999_999n },
			}),
		).rejects.toThrow(/Player not found/);
		expect(await actor.listPlayers()).toEqual(directory);
		expect(await actor.getTournamentState(room.id)).toEqual(before);
		const registered = await actor.applyTournamentCommand(room.id, {
			addPlayer: { name: "Valid", skillLevel: 2n },
		});
		expect(registered.players[0]!.registrationNumber).toBe(1n);
	});

	it("retains the shared registry, member links and registration references across repeated upgrades", async () => {
		const directory = await actor.listPlayers();
		const profiles = await actor.listUsers();
		const rooms = await actor.getTournaments();
		const states = await Promise.all(
			rooms.map((room) => actor.getTournamentState(room.id)),
		);
		for (let pass = 0; pass < 2; pass += 1) {
			await pic.upgradeCanister({
				canisterId,
				wasm: process.env.BACKEND_WASM!,
				upgradeModeOptions: {
					skip_pre_upgrade: [],
					wasm_memory_persistence: [{ keep: null }],
				},
			});
			actor = pic.createActor<_SERVICE>(idlFactory, canisterId);
			actor.setPrincipal(owner);
			expect(await actor.listPlayers()).toEqual(directory);
			expect(await actor.listUsers()).toEqual(profiles);
			expect(
				await Promise.all(
					rooms.map((room) => actor.getTournamentState(room.id)),
				),
			).toEqual(states);
		}
		const next = await actor.createPlayer({
			name: "Durable next identity",
			skillLevel: 1n,
		});
		expect(next.id).toBeGreaterThan(directory[directory.length - 1]!.id);
	});
});
