import { generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import type { PocketIcClient } from "@dfinity/pic/dist/pocket-ic-client";
import { afterAll, describe, expect, it } from "vitest";
import type { _SERVICE } from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const previousWasm = process.env.BACKEND_WASM_PREVIOUS ?? "";
const previousDeclarations = process.env.BACKEND_DECLARATIONS_PREVIOUS ?? "";
const source =
	previousDeclarations && fs.existsSync(previousDeclarations)
		? fs.readFileSync(previousDeclarations, "utf8")
		: "";
const hasTelegramBaseline =
	!!previousWasm && source.includes("completeTelegramLink");
let pic: PocketIc | undefined;
afterAll(async () => pic?.tearDown());

function previousFactory(): typeof idlFactory {
	const expression = source
		.split("export const idlFactory = ")[1]!
		.split("export const init =")[0]!
		.trim()
		.replace(/;$/, "");
	return new Function(`return (${expression});`)() as typeof idlFactory;
}

describe.skipIf(!hasTelegramBaseline)("Telegram avatar migration", () => {
	it("preserves existing member profiles, roles, Telegram links, linked players and tournament history", async () => {
		pic = await PocketIc.create(process.env.POCKET_IC_URL!);
		const factory = previousFactory();
		const owner = createIdentity("avatar-migration-owner").getPrincipal();
		const fixture = await pic.setupCanister<_SERVICE>({
			idlFactory: factory,
			wasm: previousWasm,
		});
		const previous = fixture.actor as Actor<_SERVICE>;
		previous.setPrincipal(owner);
		await previous._initialize_access_control();
		await previous.bootstrapOwner();
		await previous.saveCallerProfile({
			displayName: "Existing member",
			username: "existing_member",
		});
		await previous.setTelegramLinkConfig(["8851986381"]);
		const request = await previous.startTelegramLink();
		const issuedAt = Number(request.expiresAt / 1_000_000_000n) - 300;
		const { publicKey, privateKey } = generateKeyPairSync("rsa", {
			modulusLength: 2048,
		});
		const encode = (value: unknown) =>
			Buffer.from(JSON.stringify(value)).toString("base64url");
		const message = `${encode({ alg: "RS256", kid: "avatar-upgrade-key" })}.${encode({ iss: "https://oauth.telegram.org", aud: request.clientId, sub: "123456789", preferred_username: "telegram_member", iat: issuedAt, exp: issuedAt + 3600, nonce: request.nonce })}`;
		const proof = `${message}.${sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64url")}`;
		const require = createRequire(import.meta.url);
		const picRequire = createRequire(require.resolve("@dfinity/pic"));
		const { IDL } = picRequire("@icp-sdk/core/candid");
		const method = factory({ IDL })._fields.find(
			([name]) => name === "completeTelegramLink",
		)![1];
		const client = (pic as unknown as { client: PocketIcClient }).client;
		const submitted = await client.submitCall({
			canisterId: fixture.canisterId,
			sender: owner,
			method: "completeTelegramLink",
			payload: new Uint8Array(IDL.encode(method.argTypes, [proof])),
		});
		let pending = await pic.getPendingHttpsOutcalls();
		for (let round = 0; pending.length === 0 && round < 8; round++) {
			await pic.tick(1);
			pending = await pic.getPendingHttpsOutcalls();
		}
		expect(pending).toHaveLength(1);
		await pic.mockPendingHttpsOutcall({
			requestId: pending[0].requestId,
			subnetId: pending[0].subnetId,
			response: {
				type: "success",
				statusCode: 200,
				body: new TextEncoder().encode(
					JSON.stringify({
						keys: [
							{
								...publicKey.export({ format: "jwk" }),
								alg: "RS256",
								kid: "avatar-upgrade-key",
								use: "sig",
							},
						],
					}),
				),
				headers: [],
			},
		});
		await client.awaitCall(submitted);
		const player = await previous.createPlayer({
			name: "Paddle member",
			skillLevel: 4n,
		});
		await previous.linkPlayerToUser(player.id, owner);
		const tournament = await previous.createTournament({
			title: "Existing cup",
			description: "",
			venue: "ChillPong",
			startsAt: 1n,
			format: { singles: null },
			capacity: 8n,
			status: { upcoming: null },
		});
		await previous.applyTournamentCommand(tournament.id, {
			addExistingPlayer: { globalPlayerId: player.id },
		});
		const profile = (await previous.getCallerProfile())[0]!;
		const telegram = await previous.getCallerTelegramLink();
		const roles = await previous.listUsersWithRoles();
		const directory = await previous.listPlayers();
		const state = (await previous.getTournamentState(tournament.id))[0]!;
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
		expect((await current.getCallerProfile())[0]).toEqual({
			...profile,
			avatarUrl: [],
		});
		expect(await current.getCallerTelegramLink()).toEqual(telegram);
		expect(await current.listUsersWithRoles()).toEqual(
			roles.map((role) => ({ ...role, avatarUrl: [] })),
		);
		expect(await current.listPlayers()).toEqual(
			directory.map((entry) => ({ ...entry, avatarUrl: [] })),
		);
		expect((await current.getTournamentState(tournament.id))[0]).toEqual({
			...state,
			players: state.players.map((entry) => ({
				...entry,
				userId: [owner],
				avatarUrl: [],
			})),
		});
		expect(await current.getMyRole()).toEqual([{ admin: null }]);
		const undone = await current.applyTournamentCommand(tournament.id, {
			undo: null,
		});
		expect(undone.players).toEqual([]);
		expect((await current.listPlayers())[0]?.userId[0]?.toText()).toBe(
			owner.toText(),
		);
	}, 30_000);
});
