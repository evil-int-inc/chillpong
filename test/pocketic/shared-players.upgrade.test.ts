import fs from "node:fs";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { afterAll, describe, expect, it } from "vitest";
import type {
	TournamentState,
	_SERVICE,
} from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const previousWasm = process.env.BACKEND_WASM_PREVIOUS ?? "";
const previousDeclarations = process.env.BACKEND_DECLARATIONS_PREVIOUS ?? "";
let pic: PocketIc | undefined;
afterAll(async () => pic?.tearDown());

// Load just the self-contained factory from the trusted previous generated
// declarations, using the client's IDL rather than resolving a second SDK.
function previousFactory(): typeof idlFactory {
	const source = fs.readFileSync(previousDeclarations, "utf8");
	const expression = source
		.split("export const idlFactory = ")[1]!
		.split("export const init =")[0]!
		.trim()
		.replace(/;$/, "");
	return new Function(`return (${expression});`)() as typeof idlFactory;
}

function withoutGlobalIds(state: TournamentState) {
	return {
		...state,
		players: state.players.map(
			({ globalPlayerId: _, userId: _user, avatarUrl: _avatar, ...player }) =>
				player,
		),
	};
}

describe.skipIf(!previousWasm || !previousDeclarations)(
	"shared player migration",
	() => {
		it("migrates every legacy entrant separately while retaining bracket IDs, scored results, FIFO and undo snapshots", async () => {
			pic = await PocketIc.create(process.env.POCKET_IC_URL!);
			const owner = createIdentity("shared-migration-owner").getPrincipal();
			const fixture = await pic.setupCanister<_SERVICE>({
				idlFactory: previousFactory(),
				wasm: previousWasm,
			});
			const previous = fixture.actor as Actor<_SERVICE>;
			previous.setPrincipal(owner);
			await previous._initialize_access_control();
			await previous.bootstrapOwner();
			await previous.saveCallerProfile({
				displayName: "Legacy owner name",
				username: "legacy_owner",
			});
			const member = createIdentity("shared-migration-admin").getPrincipal();
			previous.setPrincipal(member);
			await previous._initialize_access_control();
			await previous.saveCallerProfile({
				displayName: "Legacy member name",
				username: "legacy_member",
			});
			previous.setPrincipal(owner);
			await previous.grantAdminRole(member);
			const profiles = await previous.listUsers();
			const roles = await previous.listUsersWithRoles();
			const input = {
				title: "Legacy cup",
				description: "",
				venue: "ChillPong",
				startsAt: 1n,
				format: { singles: null } as const,
				capacity: 4n,
				status: { upcoming: null } as const,
			};
			const first = await previous.createTournament(input);
			const second = await previous.createTournament({
				...input,
				title: "Other legacy cup",
			});
			for (const room of [first, second]) {
				await previous.applyTournamentCommand(room.id, {
					addPlayer: { name: "Same spelling", skillLevel: 2n },
				});
				await previous.applyTournamentCommand(room.id, {
					addPlayer: { name: "Opponent", skillLevel: 3n },
				});
			}
			const generated = await previous.applyTournamentCommand(first.id, {
				generateBracket: null,
			});
			const scored = await previous.applyTournamentCommand(first.id, {
				recordResult: {
					matchId: generated.nextMatches[0]!,
					scoreA: 11n,
					scoreB: 4n,
				},
			});
			const edited = await previous.applyTournamentCommand(first.id, {
				editPlayer: {
					playerId: 1n,
					name: "Current legacy name",
					skillLevel: 4n,
				},
			});
			const beforeSecond = (await previous.getTournamentState(second.id))[0]!;
			await pic.upgradeCanister({
				canisterId: fixture.canisterId,
				wasm: process.env.BACKEND_WASM!,
				upgradeModeOptions: {
					skip_pre_upgrade: [],
					wasm_memory_persistence: [{ keep: null }],
				},
			});
			const current = pic.createActor<_SERVICE>(idlFactory, fixture.canisterId);
			current.setPrincipal(owner);
			expect(await current.listUsers()).toEqual(
				profiles.map((user) => ({ ...user, avatarUrl: [] })),
			);
			expect(await current.listUsersWithRoles()).toEqual(
				roles.map((user) => ({ ...user, avatarUrl: [] })),
			);
			expect(await current.getMyRole()).toEqual([{ admin: null }]);
			expect(await current.getTelegramLinkConfig()).toEqual({
				clientId: ["8851986381"],
			});
			const afterFirst = (await current.getTournamentState(first.id))[0]!;
			const afterSecond = (await current.getTournamentState(second.id))[0]!;
			expect(withoutGlobalIds(afterFirst)).toEqual(edited);
			expect(withoutGlobalIds(afterSecond)).toEqual(beforeSecond);
			const identities = [...afterFirst.players, ...afterSecond.players].map(
				(player) => player.globalPlayerId[0]!,
			);
			expect(new Set(identities).size).toBe(4);
			const directory = await current.listPlayers();
			expect(directory).toHaveLength(4);
			expect(directory.every((player) => player.userId.length === 0)).toBe(
				true,
			);
			expect(
				directory.find(
					(player) => player.id === afterFirst.players[0]!.globalPlayerId[0],
				)!.name,
			).toBe("Current legacy name");
			const undone = await current.applyTournamentCommand(first.id, {
				undo: null,
			});
			expect(undone.players.map((player) => player.globalPlayerId)).toEqual(
				afterFirst.players.map((player) => player.globalPlayerId),
			);
			expect(undone.players[0]!.name).toBe("Same spelling");
			expect(undone.matches).toEqual(scored.matches);
			const reused = await current.applyTournamentCommand(second.id, {
				addExistingPlayer: {
					globalPlayerId: afterFirst.players[0]!.globalPlayerId[0]!,
				},
			});
			expect(reused.players[2]).toMatchObject({
				id: 3n,
				registrationNumber: 3n,
				globalPlayerId: afterFirst.players[0]!.globalPlayerId,
				name: "Current legacy name",
			});
			const newPlayer = await current.createPlayer({
				name: "After migration",
				skillLevel: 1n,
			});
			expect(newPlayer.id).toBeGreaterThan(
				identities.reduce((a, b) => (a > b ? a : b)),
			);
		});
	},
);
