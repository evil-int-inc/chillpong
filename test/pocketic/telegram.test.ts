import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";
import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import type { PocketIcClient } from "@dfinity/pic/dist/pocket-ic-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
	LinkRequest,
	User,
	_SERVICE,
} from "../../src/frontend/src/declarations/backend.did";
import { idlFactory } from "../../src/frontend/src/declarations/backend.did.js";

const owner = createIdentity("telegram-test-owner").getPrincipal();
const member = createIdentity("telegram-test-member").getPrincipal();
const require = createRequire(import.meta.url);
const picRequire = createRequire(require.resolve("@dfinity/pic"));
const { IDL } = picRequire("@icp-sdk/core/candid");
const anonymous: typeof owner = picRequire(
	"@icp-sdk/core/principal",
).Principal.anonymous();
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
});
const jwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });
const keyId = "telegram-test-key";
const keys = JSON.stringify({
	keys: [{ ...jwk, alg: "RS256", kid: keyId, use: "sig" }],
});
const clientId = "8851986381";
const avatarUrl = "https://cdn.telegram.org/file/test-avatar.jpg?size=320";
let pic: PocketIc;
let actor: Actor<_SERVICE>;
let canisterId: typeof owner;

function encode(value: unknown) {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function claims(request: LinkRequest, overrides: Record<string, unknown> = {}) {
	const issuedAt = Number(request.expiresAt / 1_000_000_000n) - 300;
	return {
		iss: "https://oauth.telegram.org",
		aud: request.clientId,
		sub: "123456789",
		iat: issuedAt,
		exp: issuedAt + 3_600,
		nonce: request.nonce,
		preferred_username: "Telegram_Player",
		picture: avatarUrl,
		...overrides,
	};
}

function token(
	request: LinkRequest,
	overrides: Record<string, unknown> = {},
	headerOverrides: Record<string, unknown> = {},
) {
	const message = `${encode({ alg: "RS256", kid: keyId, ...headerOverrides })}.${encode(claims(request, overrides))}`;
	return `${message}.${sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64url")}`;
}

function integer(bytes: Buffer) {
	return BigInt(`0x${bytes.toString("hex")}`);
}

function modularPower(base: bigint, exponent: bigint, modulus: bigint) {
	let result = 1n;
	let factor = base % modulus;
	let power = exponent;
	while (power > 0n) {
		if (power % 2n === 1n) result = (result * factor) % modulus;
		power /= 2n;
		factor = (factor * factor) % modulus;
	}
	return result;
}

// Build malformed PKCS#1 encoded messages and sign with the actual RSA private
// exponent. These catch verifiers that only compare a digest at the tail.
function malformedPaddingToken(
	request: LinkRequest,
	mutate: (encoded: Buffer) => void,
) {
	const message = `${encode({ alg: "RS256", kid: keyId })}.${encode(claims(request))}`;
	const digest = createHash("sha256").update(message).digest();
	const digestInfo = Buffer.concat([
		Buffer.from("3031300d060960864801650304020105000420", "hex"),
		digest,
	]);
	const encoded = Buffer.alloc(256, 0xff);
	encoded[0] = 0;
	encoded[1] = 1;
	encoded[256 - digestInfo.length - 1] = 0;
	digestInfo.copy(encoded, 256 - digestInfo.length);
	mutate(encoded);
	const signed = modularPower(
		integer(encoded),
		integer(Buffer.from(privateJwk.d!, "base64url")),
		integer(Buffer.from(privateJwk.n!, "base64url")),
	);
	const signature = Buffer.from(signed.toString(16).padStart(512, "0"), "hex");
	return `${message}.${signature.toString("base64url")}`;
}

async function completeWithKeys(
	idToken: string,
	body = keys,
	statusCode = 200,
	beforeResponse?: () => Promise<void>,
) {
	// PocketIC 0.23's DeferredActor only resolves its async promise executor,
	// losing rejected calls. Use the same submit/await client directly so the
	// outcall can be mocked before ingress polling, with rejects propagated.
	const client = (pic as unknown as { client: PocketIcClient }).client;
	const service = idlFactory({ IDL });
	const method = service._fields.find(
		([name]) => name === "completeTelegramLink",
	)![1];
	const submitted = await client.submitCall({
		canisterId,
		sender: owner,
		method: "completeTelegramLink",
		payload: new Uint8Array(IDL.encode(method.argTypes, [idToken])),
	});
	let pending = await pic.getPendingHttpsOutcalls();
	for (let round = 0; pending.length === 0 && round < 8; round++) {
		await pic.tick(1);
		pending = await pic.getPendingHttpsOutcalls();
	}
	expect(pending).toHaveLength(1);
	expect(pending[0].url).toBe(
		"https://oauth.telegram.org/.well-known/jwks.json",
	);
	if (beforeResponse) await beforeResponse();
	await pic.mockPendingHttpsOutcall({
		requestId: pending[0].requestId,
		subnetId: pending[0].subnetId,
		response: {
			type: "success",
			statusCode,
			body: new TextEncoder().encode(body),
			headers: [["Date", "irrelevant varying timestamp"]],
		},
	});
	const response = await client.awaitCall(submitted);
	return IDL.decode(method.retTypes, response.body)[0] as User;
}

async function nextRequest(principal = owner) {
	await pic.advanceTime(6_000);
	await pic.tick();
	actor.setPrincipal(principal);
	return actor.startTelegramLink();
}

beforeAll(async () => {
	pic = await PocketIc.create(process.env.POCKET_IC_URL ?? "");
	const fixture = await pic.setupCanister<_SERVICE>({
		idlFactory,
		wasm: process.env.BACKEND_WASM ?? "",
	});
	actor = fixture.actor;
	canisterId = fixture.canisterId;
});

beforeEach(async () => {
	// Reinstall the real production canister between cases; allow its IC
	// installation instruction allowance to refill first.
	await pic.advanceTime(600_000);
	await pic.tick();
	await pic.reinstallCode({
		canisterId,
		wasm: process.env.BACKEND_WASM ?? "",
	});
	actor.setPrincipal(owner);
	await actor._initialize_access_control();
	await actor.bootstrapOwner();
	await actor.createUser(owner, {
		displayName: "Existing Player Name",
		username: "existing_name",
		bio: ["Keep this bio"],
	});
	await actor.createUser(member, {
		displayName: "Other Member",
		username: "other_member",
		bio: [],
	});
	actor.setPrincipal(member);
	await actor._initialize_access_control();
	actor.setPrincipal(owner);
	await actor.setTelegramLinkConfig([clientId]);
});

afterAll(async () => {
	if (pic) await pic.tearDown();
});

describe("verified Telegram profile linking", () => {
	it("accepts a Telegram RS256 token and replaces an existing username while preserving principal, name, role, and bio", async () => {
		const request = await actor.startTelegramLink();
		const saved = await completeWithKeys(token(request));
		expect(saved.username).toBe("telegram_player");
		expect(saved.displayName).toBe("Existing Player Name");
		expect(saved.id.toText()).toBe(owner.toText());
		expect(saved.role).toEqual([{ admin: null }]);
		expect(saved.bio).toEqual(["Keep this bio"]);
		expect(saved.avatarUrl).toEqual([avatarUrl]);
		expect((await actor.getCallerProfile())[0]?.avatarUrl).toEqual([avatarUrl]);
		expect(
			(await actor.listUsersWithRoles()).find(
				(user) => user.id.toText() === owner.toText(),
			)?.avatarUrl,
		).toEqual([avatarUrl]);
		expect(await actor.getUserByUsername("existing_name")).toEqual([]);
		expect(
			(await actor.getUserByUsername("TELEGRAM_PLAYER"))[0]?.id.toText(),
		).toBe(owner.toText());
		expect((await actor.getCallerTelegramLink())[0]).toMatchObject({
			subject: "123456789",
			username: "telegram_player",
		});
	});

	it.each([
		["missing", undefined],
		["non-string", { url: avatarUrl }],
		["empty", ""],
		["non-HTTPS", "http://cdn.telegram.org/photo.jpg"],
		["script", "javascript:alert(1)"],
		["data URL", "data:image/png;base64,AAAA"],
		["credentials", "https://trusted.example@attacker.example/photo.jpg"],
		["missing host", "https:///photo.jpg"],
		["invalid host", "https://bad_host.example/photo.jpg"],
		["invalid port", "https://cdn.telegram.org:99999/photo.jpg"],
		["backslash", "https://cdn.telegram.org\\@attacker.example/photo.jpg"],
		["control character", "https://cdn.telegram.org/\nphoto.jpg"],
		["oversized", `https://cdn.telegram.org/${"a".repeat(2048)}`],
	])(
		"links successfully without an avatar for a %s picture claim",
		async (_description, picture) => {
			const request = await actor.startTelegramLink();
			const saved = await completeWithKeys(token(request, { picture }));
			expect(saved.username).toBe("telegram_player");
			expect(saved.avatarUrl).toEqual([]);
			expect((await actor.getCallerProfile())[0]?.avatarUrl).toEqual([]);
		},
	);

	it("projects current linked member avatars to the player directory and every tournament response", async () => {
		const room = await actor.createTournament({
			title: "Avatar cup",
			description: "",
			venue: "ChillPong",
			startsAt: 1n,
			format: { singles: null },
			capacity: 8n,
			status: { upcoming: null },
		});
		const player = await actor.createPlayer({
			name: "Linked player",
			skillLevel: 3n,
		});
		expect(player.avatarUrl).toEqual([]);
		await actor.applyTournamentCommand(room.id, {
			addExistingPlayer: { globalPlayerId: player.id },
		});
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const linked = await actor.linkPlayerToUser(player.id, owner);
		expect(linked.avatarUrl).toEqual([avatarUrl]);
		expect(
			(await actor.listPlayers()).find((entry) => entry.id === player.id)
				?.avatarUrl,
		).toEqual([avatarUrl]);
		expect(
			(await actor.getTournamentState(room.id))[0]?.players[0],
		).toMatchObject({ userId: [owner], avatarUrl: [avatarUrl] });
		const command = await actor.applyTournamentCommand(room.id, {
			configure: { elimination: { singleElimination: null }, tableCount: 2n },
		});
		expect(command.players[0]?.avatarUrl).toEqual([avatarUrl]);
		const next = await nextRequest();
		const nextAvatar = "https://cdn.telegram.org/file/replaced.jpg";
		await actor.completeTelegramLink(token(next, { picture: nextAvatar }));
		expect(
			(await actor.getTournamentState(room.id))[0]?.players[0]?.avatarUrl,
		).toEqual([nextAvatar]);
		expect(
			(
				await actor.updatePlayer(player.id, {
					name: "Updated linked player",
					skillLevel: 4n,
				})
			).avatarUrl,
		).toEqual([nextAvatar]);
		expect((await actor.unlinkPlayerFromUser(player.id)).avatarUrl).toEqual([]);
		expect(
			(await actor.getTournamentState(room.id))[0]?.players[0],
		).toMatchObject({ userId: [], avatarUrl: [] });
		expect((await actor.getCallerProfile())[0]?.avatarUrl).toEqual([
			nextAvatar,
		]);
	});

	it("clears an imported avatar when a newly verified Telegram profile no longer shares a picture", async () => {
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const next = await nextRequest();
		const saved = await actor.completeTelegramLink(
			token(next, { picture: undefined }),
		);
		expect(saved.avatarUrl).toEqual([]);
		expect((await actor.getCallerProfile())[0]?.avatarUrl).toEqual([]);
	});

	it("consumes the nonce and rejects replay of a successful link", async () => {
		const request = await actor.startTelegramLink();
		const proof = token(request);
		await completeWithKeys(proof);
		await expect(actor.completeTelegramLink(proof)).rejects.toThrow(
			/Start Telegram linking/,
		);
	});

	it("binds the challenge to the authenticated principal", async () => {
		const request = await actor.startTelegramLink();
		actor.setPrincipal(member);
		await actor.startTelegramLink();
		await expect(actor.completeTelegramLink(token(request))).rejects.toThrow(
			/verification did not match/,
		);
		expect(await actor.getCallerTelegramLink()).toEqual([]);
	});

	it.each([
		["issuer", { iss: "https://attacker.example" }, /issuer/],
		["audience", { aud: "123" }, /another app/],
		["nonce", { nonce: "not-the-issued-nonce" }, /verification did not match/],
		[
			"missing username",
			{ preferred_username: undefined },
			/Set a Telegram username/,
		],
		[
			"invalid username",
			{ preferred_username: "bad-handle" },
			/valid Telegram username/,
		],
		["account ID", { sub: "malformed-account" }, /account ID/],
	])(
		"rejects invalid %s before making an HTTPS outcall",
		async (_label, override, error) => {
			const request = await actor.startTelegramLink();
			await expect(
				actor.completeTelegramLink(token(request, override)),
			).rejects.toThrow(error);
			expect(await pic.getPendingHttpsOutcalls()).toEqual([]);
			expect((await actor.getCallerProfile())[0]?.username).toBe(
				"existing_name",
			);
		},
	);

	it("rejects an expired token and a future issue time", async () => {
		const request = await actor.startTelegramLink();
		const now = Number(request.expiresAt / 1_000_000_000n) - 300;
		await expect(
			actor.completeTelegramLink(token(request, { exp: now - 1 })),
		).rejects.toThrow(/timestamp/);
		await expect(
			actor.completeTelegramLink(token(request, { iat: now + 120 })),
		).rejects.toThrow(/timestamp/);
	});

	it("expires linking challenges even if the JWT itself is unexpired", async () => {
		const request = await actor.startTelegramLink();
		await pic.advanceTime(301_000);
		await pic.tick();
		await expect(actor.completeTelegramLink(token(request))).rejects.toThrow(
			/link expired/,
		);
	});

	it("rechecks token expiration after the Telegram keys request completes", async () => {
		const request = await actor.startTelegramLink();
		const now = Number(request.expiresAt / 1_000_000_000n) - 300;
		await expect(
			completeWithKeys(
				token(request, { exp: now + 2 }),
				keys,
				200,
				async () => {
					await pic.advanceTime(3_000);
					await pic.tick();
				},
			),
		).rejects.toThrow(/timestamp/);
		expect((await actor.getCallerProfile())[0]?.username).toBe("existing_name");
		expect(await actor.getCallerTelegramLink()).toEqual([]);
	});

	it("invalidates an in-flight proof if an admin changes the Login client", async () => {
		const request = await actor.startTelegramLink();
		await expect(
			completeWithKeys(token(request), keys, 200, async () => {
				await actor.setTelegramLinkConfig(["1234567890"]);
			}),
		).rejects.toThrow(/verification did not match/);
		expect((await actor.getCallerProfile())[0]?.username).toBe("existing_name");
		expect(await actor.getCallerTelegramLink()).toEqual([]);
	});

	it("rejects all non-RS256 algorithms and critical-header extensions", async () => {
		const request = await actor.startTelegramLink();
		for (const alg of ["none", "HS256", "ES256", "EdDSA"]) {
			await expect(
				actor.completeTelegramLink(token(request, {}, { alg })),
			).rejects.toThrow(/RS256/);
		}
		await expect(
			actor.completeTelegramLink(token(request, {}, { crit: ["b64"] })),
		).rejects.toThrow(/Unsupported/);
	});

	it("rejects duplicate claim keys instead of accepting a parser-dependent nonce", async () => {
		const request = await actor.startTelegramLink();
		const payload = JSON.stringify(claims(request)).replace(
			/}$/,
			',"nonce":"other"}',
		);
		const message = `${encode({ alg: "RS256", kid: keyId })}.${Buffer.from(payload).toString("base64url")}`;
		const proof = `${message}.${sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64url")}`;
		await expect(actor.completeTelegramLink(proof)).rejects.toThrow(
			/Duplicate/,
		);
	});

	it("rejects a token signed with an unrelated RSA key", async () => {
		const request = await actor.startTelegramLink();
		const before = (await actor.getCallerProfile())[0];
		const message = token(request, {
			picture: "https://attacker.example/avatar.jpg",
		})
			.split(".")
			.slice(0, 2)
			.join(".");
		const unrelated = generateKeyPairSync("rsa", { modulusLength: 2048 });
		const proof = `${message}.${sign("RSA-SHA256", Buffer.from(message), unrelated.privateKey).toString("base64url")}`;
		await expect(completeWithKeys(proof)).rejects.toThrow(
			/Invalid Telegram token signature/,
		);
		expect(await actor.getCallerTelegramLink()).toEqual([]);
		expect((await actor.getCallerProfile())[0]).toEqual(before);
	});

	it.each([
		[
			"block type",
			(encoded: Buffer) => {
				encoded[1] = 2;
			},
		],
		[
			"padding byte",
			(encoded: Buffer) => {
				encoded[15] = 0xfe;
			},
		],
		[
			"early separator",
			(encoded: Buffer) => {
				encoded[15] = 0;
			},
		],
		[
			"DER algorithm prefix",
			(encoded: Buffer) => {
				encoded[220] ^= 1;
			},
		],
		[
			"digest",
			(encoded: Buffer) => {
				encoded[255] ^= 1;
			},
		],
	])("rejects RSA signature with incorrect %s", async (_label, mutate) => {
		const request = await actor.startTelegramLink();
		await expect(
			completeWithKeys(malformedPaddingToken(request, mutate)),
		).rejects.toThrow(/Invalid Telegram token signature/);
	});

	it("rejects truncated signatures instead of accepting leading-zero normalization", async () => {
		const request = await actor.startTelegramLink();
		const parts = token(request).split(".");
		parts[2] = Buffer.from(parts[2], "base64url")
			.subarray(1)
			.toString("base64url");
		await expect(completeWithKeys(parts.join("."))).rejects.toThrow(
			/Invalid Telegram token signature/,
		);
	});

	it("rejects username conflicts atomically and retains the original username", async () => {
		await actor.updateUser(member, {
			displayName: "Other Member",
			username: "telegram_player",
			bio: [],
		});
		const request = await actor.startTelegramLink();
		await expect(completeWithKeys(token(request))).rejects.toThrow(
			/Username already taken/,
		);
		expect(await actor.getCallerTelegramLink()).toEqual([]);
		expect((await actor.getCallerProfile())[0]?.username).toBe("existing_name");
		expect(
			(await actor.getUserByUsername("telegram_player"))[0]?.id.toText(),
		).toBe(member.toText());
	});

	it("prevents the same Telegram account being linked to two principals", async () => {
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const otherRequest = await nextRequest(member);
		await expect(
			actor.completeTelegramLink(
				token(otherRequest, { preferred_username: "different_handle" }),
			),
		).rejects.toThrow(/already linked to another member/);
		expect((await actor.getCallerProfile())[0]?.username).toBe("other_member");
	});

	it("uses a fresh proof to sync a changed Telegram username and retires the previous username index", async () => {
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const next = await nextRequest();
		const saved = await actor.completeTelegramLink(
			token(next, { preferred_username: "NewTelegramName" }),
		);
		expect(saved.username).toBe("newtelegramname");
		expect(await actor.getUserByUsername("telegram_player")).toEqual([]);
		expect((await actor.getCallerTelegramLink())[0]?.username).toBe(
			"newtelegramname",
		);
	});

	it("does not repeatedly fetch paid HTTPS keys for arbitrary token key IDs", async () => {
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const next = await nextRequest();
		await expect(
			actor.completeTelegramLink(token(next, {}, { kid: "unknown-key" })),
		).rejects.toThrow(/verification key has changed/);
		expect(await pic.getPendingHttpsOutcalls()).toEqual([]);
		expect((await actor.getCallerProfile())[0]?.username).toBe(
			"telegram_player",
		);
	});

	it("accepts a 32-character verified Telegram username", async () => {
		const request = await actor.startTelegramLink();
		const username = "a".repeat(32);
		const saved = await completeWithKeys(
			token(request, { preferred_username: username }),
		);
		expect(saved.username).toBe(username);
	});

	it("unlinking releases the Telegram identity while keeping profile fields", async () => {
		const request = await actor.startTelegramLink();
		await completeWithKeys(token(request));
		const user = await actor.unlinkTelegram();
		expect(user.username).toBe("telegram_player");
		expect(user.displayName).toBe("Existing Player Name");
		expect(user.avatarUrl).toEqual([avatarUrl]);
		expect(await actor.getCallerTelegramLink()).toEqual([]);
		const next = await nextRequest(member);
		const linked = await actor.completeTelegramLink(
			token(next, { preferred_username: "different_handle" }),
		);
		expect(linked.id.toText()).toBe(member.toText());
	});

	it("invalidates an old challenge when the public client configuration changes", async () => {
		const request = await actor.startTelegramLink();
		await actor.setTelegramLinkConfig(["1234567890"]);
		await expect(actor.completeTelegramLink(token(request))).rejects.toThrow(
			/Start Telegram linking/,
		);
	});

	it("only admins can configure Telegram and anonymous callers cannot link or unlink", async () => {
		actor.setPrincipal(member);
		await expect(actor.setTelegramLinkConfig(["123"])).rejects.toThrow(
			/Unauthorized/,
		);
		actor.setPrincipal(anonymous);
		await expect(actor.startTelegramLink()).rejects.toThrow(/Sign in/);
		await expect(actor.completeTelegramLink("invalid")).rejects.toThrow(
			/Sign in/,
		);
		await expect(actor.unlinkTelegram()).rejects.toThrow(/Sign in/);
		expect(await actor.getCallerTelegramLink()).toEqual([]);
	});

	it("validates public client IDs and allows administrators to disable linking", async () => {
		for (const invalid of [
			"0",
			"a-secret-is-not-a-client-id",
			"9007199254740992",
		]) {
			await expect(actor.setTelegramLinkConfig([invalid])).rejects.toThrow(
				/Invalid Telegram/,
			);
		}
		await actor.setTelegramLinkConfig([]);
		await expect(actor.startTelegramLink()).rejects.toThrow(/not configured/);
	});

	it("fails closed when Telegram keys are unavailable", async () => {
		const request = await actor.startTelegramLink();
		await expect(
			completeWithKeys(token(request), "unavailable", 503),
		).rejects.toThrow(/temporarily unavailable/);
		expect((await actor.getCallerProfile())[0]?.username).toBe("existing_name");
	});

	it("rejects ambiguous key IDs and weak or unrelated JWKS", async () => {
		const request = await actor.startTelegramLink();
		const ambiguous = JSON.stringify({
			keys: [
				{ ...jwk, alg: "RS256", kid: keyId },
				{ ...jwk, alg: "RS256", kid: keyId },
			],
		});
		await expect(completeWithKeys(token(request), ambiguous)).rejects.toThrow(
			/temporarily unavailable/,
		);
	});

	it("normalizes HTTPS keys independently of metadata and response headers", async () => {
		const keyBody = JSON.stringify(
			{
				keys: [
					{ ...jwk, kid: keyId, alg: "RS256", ext: true, key_ops: ["verify"] },
				],
			},
			null,
			3,
		);
		const transformed = await actor.telegramKeysTransform({
			context: new Uint8Array(),
			response: {
				status: 200n,
				headers: [{ name: "Date", value: "one timestamp" }],
				body: new TextEncoder().encode(keyBody),
			},
		});
		expect(transformed.headers).toEqual([]);
		expect(JSON.parse(new TextDecoder().decode(transformed.body))).toEqual({
			keys: [{ alg: "RS256", kty: "RSA", kid: keyId, n: jwk.n, e: "AQAB" }],
		});
	});
});
