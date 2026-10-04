import { Principal } from "@icp-sdk/core/principal";
import {
  Role,
  type Tournament,
  TournamentFormat,
  TournamentStatus,
  type User,
  UserRole,
  type UserRoleView,
  type backendInterface,
} from "../backend";

/**
 * In-memory visual-QA fixture. Core infrastructure loads this module only when
 * VITE_USE_MOCK=true; production pages read the real canister.
 */
const OWNER = Principal.fromUint8Array(new Uint8Array([1, 1]));
const NIKA = Principal.fromUint8Array(new Uint8Array([2, 1]));
const MARIAM = Principal.fromUint8Array(new Uint8Array([3, 1]));
const GIORGI = Principal.fromUint8Array(new Uint8Array([4, 1]));
const NS_PER_DAY = 86_400_000_000_000n;
const now = () => BigInt(Date.now()) * 1_000_000n;
const fixtureTime = now();

let users: User[] = [
  {
    id: OWNER,
    displayName: "The ChillPong Crew",
    username: "chillpong",
    bio: "Keeping the tables moving after dark.",
    role: Role.admin,
    createdAt: fixtureTime - 90n * NS_PER_DAY,
  },
  {
    id: NIKA,
    displayName: "Nika Beridze",
    username: "nika",
    bio: "Left-handed. Here for the rallies.",
    createdAt: fixtureTime - 30n * NS_PER_DAY,
  },
  {
    id: MARIAM,
    displayName: "Mariam Japaridze",
    username: "mariam",
    bio: "One more game is always the plan.",
    createdAt: fixtureTime - 14n * NS_PER_DAY,
  },
  {
    id: GIORGI,
    displayName: "Giorgi Maisuradze",
    username: "giorgi",
    bio: "Meet you at the table.",
    createdAt: fixtureTime - 7n * NS_PER_DAY,
  },
];

let tournaments: Tournament[] = [
  {
    id: 1n,
    title: "Basement Open",
    description:
      "Singles, loud music, long rallies. Arrive 20 minutes before the first game for the player briefing.",
    venue: "ChillPong / Tbilisi",
    startsAt: fixtureTime + 3n * NS_PER_DAY,
    format: TournamentFormat.singles,
    capacity: 32n,
    status: TournamentStatus.upcoming,
    createdAt: fixtureTime - 7n * NS_PER_DAY,
    updatedAt: fixtureTime - 7n * NS_PER_DAY,
  },
  {
    id: 2n,
    title: "Last Call Doubles",
    description:
      "Bring your teammate. Teams of two, quick exchanges and a late finish.",
    venue: "ChillPong / Tbilisi",
    startsAt: fixtureTime - 3_600_000_000_000n,
    format: TournamentFormat.doubles,
    capacity: 24n,
    status: TournamentStatus.live,
    createdAt: fixtureTime - 10n * NS_PER_DAY,
    updatedAt: fixtureTime,
  },
  {
    id: 3n,
    title: "Sunday Sessions",
    description: "A night of friendly competition and familiar faces.",
    venue: "ChillPong / Tbilisi",
    startsAt: fixtureTime - 7n * NS_PER_DAY,
    format: TournamentFormat.singles,
    capacity: 16n,
    status: TournamentStatus.completed,
    createdAt: fixtureTime - 20n * NS_PER_DAY,
    updatedAt: fixtureTime - 6n * NS_PER_DAY,
  },
];
let nextTournamentId = 4n;

function findUser(id: Principal): User | undefined {
  return users.find((user) => user.id.toString() === id.toString());
}

function requireUser(id: Principal): User {
  const user = findUser(id);
  if (!user) throw new Error("Member not found.");
  return user;
}

function roleView(user: User): UserRoleView {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    role: user.role,
  };
}

export const mockBackend: backendInterface = {
  _immutableObjectStorageBlobsAreLive: async (hashes) =>
    hashes.map(() => false),
  _immutableObjectStorageBlobsToDelete: async () => [],
  _immutableObjectStorageConfirmBlobDeletion: async () => undefined,
  _immutableObjectStorageCreateCertificate: async (blobHash) => ({
    method: "PUT",
    blob_hash: blobHash,
  }),
  _immutableObjectStorageRefillCashier: async () => ({ success: true }),
  _immutableObjectStorageUpdateGatewayPrincipals: async () => undefined,
  _initialize_access_control: async () => undefined,
  _internet_identity_sign_in_finish: async () => ({ __kind__: "ok", ok: null }),
  _internet_identity_sign_in_start: async () => new Uint8Array(),
  assignCallerUserRole: async (id, role) => {
    if (role !== UserRole.admin) {
      throw new Error("Only the admin role may be assigned.");
    }
    requireUser(id).role = Role.admin;
  },
  bootstrapOwner: async () => {
    requireUser(OWNER).role = Role.admin;
  },
  createTournament: async (input) => {
    const tournament: Tournament = {
      ...input,
      id: nextTournamentId++,
      createdAt: now(),
      updatedAt: now(),
    };
    tournaments = [...tournaments, tournament];
    return { ...tournament };
  },
  createUser: async (id, input) => {
    if (findUser(id)) throw new Error("This member already exists.");
    if (users.some((user) => user.username === input.username)) {
      throw new Error("This username is already taken.");
    }
    const user: User = { ...input, id, createdAt: now() };
    users = [...users, user];
    return { ...user };
  },
  execute: async () => ({ hasMore: false, rows: [] }),
  getApiDoc: async () => "# ChillPong visual-QA fixture",
  getCallerProfile: async () => ({ ...requireUser(OWNER) }),
  getCallerUserRole: async () => UserRole.admin,
  getMyRole: async () => Role.admin,
  getTournament: async (id) => {
    const tournament = tournaments.find((item) => item.id === id);
    return tournament ? { ...tournament } : null;
  },
  getTournaments: async () => tournaments.map((item) => ({ ...item })),
  getUser: async (id) => {
    const user = findUser(id);
    return user ? { ...user } : null;
  },
  getUserByUsername: async (username) => {
    const user = users.find((item) => item.username === username.toLowerCase());
    return user ? { ...user } : null;
  },
  grantAdminRole: async (id) => {
    const user = requireUser(id);
    user.role = Role.admin;
    return roleView(user);
  },
  isCallerAdmin: async () => true,
  listUsers: async () => users.map((user) => ({ ...user })),
  listUsersWithRoles: async () => users.map(roleView),
  revokeAdminRole: async (id) => {
    if (id.toString() === OWNER.toString()) {
      throw new Error("The owner keeps admin access.");
    }
    const user = requireUser(id);
    user.role = undefined;
    return roleView(user);
  },
  schema: async () => JSON.stringify({ tables: ["users", "tournaments"] }),
  updateTournament: async (id, input) => {
    const tournament = tournaments.find((item) => item.id === id);
    if (!tournament) throw new Error("Tournament not found.");
    Object.assign(tournament, input, { updatedAt: now() });
    return { ...tournament };
  },
  updateUser: async (id, input) => {
    const user = requireUser(id);
    if (
      users.some(
        (item) =>
          item.username === input.username &&
          item.id.toString() !== id.toString(),
      )
    ) {
      throw new Error("This username is already taken.");
    }
    Object.assign(user, input);
    return { ...user };
  },
};
