import { type Actor, PocketIc, createIdentity } from "@dfinity/pic";
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  _SERVICE,
  TournamentInput,
  UserInput,
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
const anonymous: typeof owner = picRequire("@icp-sdk/core/principal").Principal.anonymous();
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
  grantAdminRole(target: typeof owner): Promise<Pick<LegacyUser, "id" | "displayName" | "username" | "role">>;
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
    saveProfile: IDL.Func([
      IDL.Text, IDL.Text, IDL.Opt(IDL.Vec(IDL.Nat8)), IDL.Bool, IDL.Opt(IDL.Text),
    ], [user], []),
    grantAdminRole: IDL.Func([IDL.Principal], [userRoleView], []),
  });
};

function userInput(overrides: Partial<UserInput> = {}): UserInput {
  return { displayName: "Nino", username: "nino", bio: [], ...overrides };
}

function tournamentInput(overrides: Partial<TournamentInput> = {}): TournamentInput {
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
  await actor.createUser(owner, userInput({ displayName: "Owner", username: "owner" }));
  await actor.createUser(member, userInput({ displayName: "Member", username: "member" }));
  actor.setPrincipal(member);
  await actor._initialize_access_control();
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
    const oldOwner = await legacy.saveProfile("Original Owner", "LegacyOwner", [avatar], false, ["The original crew"]);
    await legacy.bootstrapOwner();
    legacy.setPrincipal(member);
    await legacy._initialize_access_control();
    const oldMember = await legacy.saveProfile("Nino", "NINO", [], false, ["A legacy member"]);
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
    expect((await upgraded.getUserByUsername("  NINO  "))[0]?.id.toText()).toBe(member.toText());
    await expect(upgraded.createUser(createIdentity("legacy-duplicate").getPrincipal(), userInput({ username: "nino" })))
      .rejects.toThrow(/Username already taken/);
    expect(await upgraded.listUsers()).toHaveLength(2);
    const schema = JSON.parse(await upgraded.schema()) as { entities: Array<{ name: string }> };
    expect(schema.entities.map((entity) => entity.name).sort()).toEqual(["tournament", "user"]);
    expect(await upgraded.getTournaments()).toEqual([]);
    expect(await upgraded.getMyRole()).toEqual([{ admin: null }]);
    upgraded.setPrincipal(member);
    expect(await upgraded.getMyRole()).toEqual([{ admin: null }]);
    const tournament = await upgraded.createTournament(tournamentInput({ title: "First night after migration" }));
    expect(tournament.id).toBe(0n);
    expect((await upgraded.getTournament(tournament.id))[0]?.title).toBe("First night after migration");
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
    expect(await actor.listUsers()).toEqual(expect.arrayContaining([
      expect.objectContaining({ displayName: "Owner", role: [{ admin: null }] }),
      expect.objectContaining({ displayName: "Member", role: [] }),
    ]));
    expect((await actor.getUser(member))[0]?.username).toBe("member");
    expect((await actor.getUserByUsername("member"))[0]?.id.toText()).toBe(member.toText());
    expect(await actor.getUser(createIdentity("missing-user").getPrincipal())).toEqual([]);
    expect(await actor.getUserByUsername("missing-user")).toEqual([]);
    actor.setPrincipal(createIdentity("unregistered-caller").getPrincipal());
    expect(await actor.getMyRole()).toEqual([]);
  });

  it.each([
    { name: "anonymous", principal: anonymous },
    { name: "ordinary member", principal: member },
  ])("rejects every user and tournament mutation from an $name", async ({ principal }) => {
    const tournament = await actor.createTournament(tournamentInput());
    const newId = createIdentity(`denied-${principal.toText()}`).getPrincipal();
    actor.setPrincipal(principal);
    await expect(actor.createUser(newId, userInput())).rejects.toThrow(/Unauthorized/);
    await expect(actor.updateUser(member, userInput())).rejects.toThrow(/Unauthorized/);
    await expect(actor.createTournament(tournamentInput())).rejects.toThrow(/Unauthorized/);
    await expect(actor.updateTournament(tournament.id, tournamentInput())).rejects.toThrow(/Unauthorized/);
    await expect(actor.listUsersWithRoles()).rejects.toThrow(/Unauthorized/);
    expect(await actor.getUser(newId)).toEqual([]);
    expect((await actor.getUser(member))[0]?.displayName).toBe("Member");
    expect((await actor.getTournament(tournament.id))[0]?.title).toBe("Warehouse Cup");
  });

  it("normalizes usernames, updates their lookup, and preserves an existing admin role", async () => {
    const principal = createIdentity("editable-user").getPrincipal();
    const created = await actor.createUser(principal, userInput({
      displayName: "  Nino  ", username: "  NINO_EDIT  ", bio: ["  Plays doubles  "],
    }));
    expect(created.displayName).toBe("Nino");
    expect(created.username).toBe("nino_edit");
    expect(created.bio).toEqual(["Plays doubles"]);
    expect(created.role).toEqual([]);
    await actor.grantAdminRole(principal);

    const updated = await actor.updateUser(principal, userInput({
      displayName: "Nino B", username: "nino-b", bio: [],
    }));
    expect(updated.id.toText()).toBe(principal.toText());
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.role).toEqual([{ admin: null }]);
    expect(updated.bio).toEqual([]);
    expect(await actor.getUserByUsername("nino_edit")).toEqual([]);
    expect((await actor.getUserByUsername("nino-b"))[0]?.displayName).toBe("Nino B");
    actor.setPrincipal(principal);
    expect(await actor.getMyRole()).toEqual([{ admin: null }]);
    actor.setPrincipal(owner);
    await actor.revokeAdminRole(principal);
    actor.setPrincipal(principal);
    expect(await actor.getMyRole()).toEqual([]);
  });

  it("rejects duplicate usernames atomically when creating or renaming a member", async () => {
    const principal = createIdentity("duplicate-user").getPrincipal();
    await expect(actor.createUser(principal, userInput({ username: "  MEMBER  " })))
      .rejects.toThrow(/Username already taken/);
    expect(await actor.getUser(principal)).toEqual([]);

    await actor.createUser(principal, userInput({ username: "original-handle" }));
    await expect(actor.updateUser(principal, userInput({ username: "member" })))
      .rejects.toThrow(/Username already taken/);
    expect((await actor.getUserByUsername("original-handle"))[0]?.id.toText()).toBe(principal.toText());
    expect((await actor.getUserByUsername("member"))[0]?.id.toText()).toBe(member.toText());
    await expect(actor.createUser(principal, userInput({ username: "another-handle" })))
      .rejects.toThrow(/User already exists/);
  });

  it.each([
    { input: userInput({ displayName: " " }), error: /Display name/ },
    { input: userInput({ username: "ab" }), error: /Username must be/ },
    { input: userInput({ username: "not a handle" }), error: /Username may only/ },
    { input: userInput({ bio: ["x".repeat(501)] }), error: /Bio must be/ },
  ])("validates user input before storing it ($error)", async ({ input, error }) => {
    const principal = createIdentity(`invalid-user-${String(error)}`).getPrincipal();
    await expect(actor.createUser(principal, input)).rejects.toThrow(error);
    expect(await actor.getUser(principal)).toEqual([]);
  });

  it("rejects anonymous user identities and missing members", async () => {
    await expect(actor.createUser(anonymous, userInput())).rejects.toThrow(/Anonymous/);
    await expect(actor.updateUser(createIdentity("unknown-edit").getPrincipal(), userInput()))
      .rejects.toThrow(/User not found/);
  });

  it("creates, publicly reads and edits a tournament while retaining its identity and creation time", async () => {
    const input = tournamentInput({ title: "  Friday Rally  ", venue: "  Basement Bar  " });
    const created = await actor.createTournament(input);
    expect(created).toMatchObject({
      ...input, title: "Friday Rally", venue: "Basement Bar",
    });
    actor.setPrincipal(anonymous);
    expect(await actor.getTournaments()).toContainEqual(created);
    expect(await actor.getTournament(created.id)).toEqual([created]);
    expect(await actor.getTournament(999_999n)).toEqual([]);
    actor.setPrincipal(owner);
    const updated = await actor.updateTournament(created.id, tournamentInput({
      title: "Friday Doubles", format: { doubles: null }, capacity: 24n, status: { live: null },
    }));
    expect(updated).toMatchObject({
      id: created.id, createdAt: created.createdAt,
      title: "Friday Doubles", format: { doubles: null }, capacity: 24n, status: { live: null },
    });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(await actor.getTournament(created.id)).toEqual([updated]);
  });

  it.each([
    { input: tournamentInput({ title: " " }), error: /title/i },
    { input: tournamentInput({ venue: " " }), error: /venue/i },
    { input: tournamentInput({ description: "x".repeat(2001) }), error: /description/i },
    { input: tournamentInput({ startsAt: 0n }), error: /start/i },
    { input: tournamentInput({ capacity: 1n }), error: /capacity/i },
    { input: tournamentInput({ capacity: 257n }), error: /capacity/i },
  ])("validates tournament input before changing the board ($error)", async ({ input, error }) => {
    const before = await actor.getTournaments();
    await expect(actor.createTournament(input)).rejects.toThrow(error);
    expect(await actor.getTournaments()).toEqual(before);
    await expect(actor.updateTournament(before[0]!.id, input)).rejects.toThrow(error);
    expect(await actor.getTournaments()).toEqual(before);
  });

  it("keeps public and admin role reads aligned with generic package role assignments", async () => {
    await actor.grantAdminRole(member);
    try {
      await actor.assignCallerUserRole(member, { user: null });
      actor.setPrincipal(member);
      expect(await actor.getMyRole()).toEqual([]);
      expect((await actor.getUser(member))[0]?.role).toEqual([]);
      expect((await actor.getUserByUsername("member"))[0]?.role).toEqual([]);
      expect((await actor.listUsers()).find((user) => user.id.toText() === member.toText())?.role).toEqual([]);
      await expect(actor.createTournament(tournamentInput())).rejects.toThrow(/Unauthorized/);
      actor.setPrincipal(owner);
      expect((await actor.listUsersWithRoles()).find((user) => user.id.toText() === member.toText())?.role).toEqual([]);

      await actor.assignCallerUserRole(member, { admin: null });
      actor.setPrincipal(member);
      expect(await actor.getMyRole()).toEqual([{ admin: null }]);
      expect((await actor.getUser(member))[0]?.role).toEqual([{ admin: null }]);
      expect((await actor.listUsers()).find((user) => user.id.toText() === member.toText())?.role).toEqual([{ admin: null }]);
      actor.setPrincipal(owner);
      expect((await actor.listUsersWithRoles()).find((user) => user.id.toText() === member.toText())?.role).toEqual([{ admin: null }]);
    } finally {
      actor.setPrincipal(owner);
      await actor.assignCallerUserRole(member, { user: null });
    }
  });

  it("prevents member role escalation and keeps the original owner admin on repeated setup", async () => {
    actor.setPrincipal(member);
    await expect(actor.grantAdminRole(member)).rejects.toThrow(/Unauthorized/);
    await expect(actor.revokeAdminRole(owner)).rejects.toThrow(/Unauthorized|owner/i);
    await expect(actor.assignCallerUserRole(member, { admin: null })).rejects.toThrow(/Unauthorized/);
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
    expect(await actor.listUsersWithRoles()).toEqual(expect.arrayContaining([
      expect.objectContaining({ username: "owner", role: [{ admin: null }] }),
      expect.objectContaining({ username: "member", role: [] }),
    ]));
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
    const tournament = await actor.createTournament(tournamentInput({ title: "After upgrade" }));
    expect(tournament.id).toBeGreaterThan(tournaments.reduce((max, item) => item.id > max ? item.id : max, 0n));
  });
});
