import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
import type { ExternalBlob } from "@caffeineai/object-storage";
export type { ExternalBlob } from "@caffeineai/object-storage";
export interface Cell {
    value: Value;
    name: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export type MatchSource = {
    __kind__: "bye";
    bye: null;
} | {
    __kind__: "player";
    player: bigint;
} | {
    __kind__: "winner";
    winner: bigint;
} | {
    __kind__: "loser";
    loser: bigint;
};
export interface Result {
    hasMore: boolean;
    rows: Array<Array<Cell>>;
}
export type Result__1 = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type Timestamp = bigint;
export interface Tournament {
    id: bigint;
    status: TournamentStatus;
    title: string;
    venue: string;
    startsAt: Timestamp;
    createdAt: Timestamp;
    description: string;
    updatedAt: Timestamp;
    capacity: bigint;
    format: TournamentFormat;
}
export interface TournamentAction {
    id: bigint;
    createdAt: Timestamp;
    caption: string;
}
export type TournamentCommand = {
    __kind__: "prioritizeMatch";
    prioritizeMatch: bigint;
} | {
    __kind__: "startMatch";
    startMatch: bigint;
} | {
    __kind__: "setMatchPlayers";
    setMatchPlayers: {
        matchId: bigint;
        playerA?: bigint;
        playerB?: bigint;
    };
} | {
    __kind__: "undo";
    undo: null;
} | {
    __kind__: "placePlayer";
    placePlayer: {
        playerId: bigint;
        slot: TournamentSlot;
        matchId: bigint;
    };
} | {
    __kind__: "prioritizePlayer";
    prioritizePlayer: bigint;
} | {
    __kind__: "generateBracket";
    generateBracket: null;
} | {
    __kind__: "movePlayer";
    movePlayer: {
        playerId: bigint;
        slot: TournamentSlot;
        matchId: bigint;
    };
} | {
    __kind__: "swapPlayers";
    swapPlayers: {
        firstSlot: TournamentSlot;
        secondSlot: TournamentSlot;
        firstMatchId: bigint;
        secondMatchId: bigint;
    };
} | {
    __kind__: "removePlayer";
    removePlayer: {
        playerId: bigint;
        confirmed: boolean;
    };
} | {
    __kind__: "configure";
    configure: {
        elimination: TournamentElimination;
        tableCount: bigint;
    };
} | {
    __kind__: "assignTable";
    assignTable: {
        table?: bigint;
        matchId: bigint;
    };
} | {
    __kind__: "assignBye";
    assignBye: {
        slot: TournamentSlot;
        matchId: bigint;
    };
} | {
    __kind__: "recordResult";
    recordResult: {
        scoreA: bigint;
        scoreB: bigint;
        matchId: bigint;
    };
} | {
    __kind__: "resetMatch";
    resetMatch: {
        cascade: boolean;
        matchId: bigint;
    };
} | {
    __kind__: "addPlayer";
    addPlayer: {
        name: string;
        skillLevel: bigint;
    };
} | {
    __kind__: "editPlayer";
    editPlayer: {
        playerId: bigint;
        name: string;
        skillLevel: bigint;
    };
};
export interface TournamentInput {
    status: TournamentStatus;
    title: string;
    venue: string;
    startsAt: Timestamp;
    description: string;
    capacity: bigint;
    format: TournamentFormat;
}
export interface TournamentMatch {
    id: bigint;
    status: TournamentMatchStatus;
    table?: bigint;
    winnerId?: bigint;
    scoreA?: bigint;
    scoreB?: bigint;
    loserId?: bigint;
    manualOverride: boolean;
    playerA?: bigint;
    playerB?: bigint;
    bracket: TournamentBracket;
    sourceA: MatchSource;
    sourceB: MatchSource;
    priority: bigint;
    position: bigint;
    round: bigint;
}
export interface TournamentPlayer {
    id: bigint;
    status: TournamentPlayerStatus;
    table?: bigint;
    name: string;
    seed?: bigint;
    losses: bigint;
    registrationNumber: bigint;
    currentMatchId?: bigint;
    skillLevel: bigint;
    registeredAt: Timestamp;
}
export interface TournamentState {
    elimination: TournamentElimination;
    started: boolean;
    waitingQueue: Array<bigint>;
    nextMatches: Array<bigint>;
    history: Array<TournamentAction>;
    canUndo: boolean;
    tables: Array<TournamentTable>;
    updatedAt: Timestamp;
    matches: Array<TournamentMatch>;
    players: Array<TournamentPlayer>;
    tableCount: bigint;
    tournamentId: bigint;
    championId?: bigint;
}
export interface TournamentTable {
    status: TournamentTableStatus;
    matchId?: bigint;
    number: bigint;
}
export interface User {
    id: UserId;
    bio?: string;
    username: string;
    displayName: string;
    createdAt: Timestamp;
    role?: Role;
    avatar?: ExternalBlob;
}
export type UserId = Principal;
export interface UserInput {
    bio?: string;
    username: string;
    displayName: string;
}
export interface UserRoleView {
    id: UserId;
    username: string;
    displayName: string;
    role?: Role;
}
export type Value = {
    __kind__: "int";
    int: bigint;
} | {
    __kind__: "nat";
    nat: bigint;
} | {
    __kind__: "float";
    float: number;
} | {
    __kind__: "bool";
    bool: boolean;
} | {
    __kind__: "null";
    null: null;
} | {
    __kind__: "text";
    text: string;
};
export enum Role {
    admin = "admin"
}
export enum TournamentBracket {
    losers = "losers",
    grandFinal = "grandFinal",
    resetFinal = "resetFinal",
    winners = "winners"
}
export enum TournamentElimination {
    singleElimination = "singleElimination",
    doubleElimination = "doubleElimination"
}
export enum TournamentFormat {
    doubles = "doubles",
    singles = "singles"
}
export enum TournamentMatchStatus {
    bye = "bye",
    cancelled = "cancelled",
    blocked = "blocked",
    completed = "completed",
    playing = "playing",
    ready = "ready"
}
export enum TournamentPlayerStatus {
    advanced = "advanced",
    playing = "playing",
    eliminated = "eliminated",
    champion = "champion",
    waiting = "waiting",
    ready = "ready",
    removed = "removed"
}
export enum TournamentSlot {
    a = "a",
    b = "b"
}
export enum TournamentStatus {
    upcoming = "upcoming",
    live = "live",
    completed = "completed"
}
export enum TournamentTableStatus {
    available = "available",
    playing = "playing",
    finished = "finished",
    waiting = "waiting"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    applyTournamentCommand(id: bigint, command: TournamentCommand): Promise<TournamentState>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    bootstrapOwner(): Promise<void>;
    createTournament(input: TournamentInput): Promise<Tournament>;
    createUser(userId: UserId, input: UserInput): Promise<User>;
    execute(qJson: string): Promise<Result>;
    getApiDoc(): Promise<string>;
    getCallerProfile(): Promise<User | null>;
    getCallerUserRole(): Promise<UserRole>;
    getMyRole(): Promise<Role | null>;
    getTournament(id: bigint): Promise<Tournament | null>;
    getTournamentState(id: bigint): Promise<TournamentState | null>;
    getTournaments(): Promise<Array<Tournament>>;
    getUser(userId: UserId): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    grantAdminRole(target: UserId): Promise<UserRoleView>;
    isCallerAdmin(): Promise<boolean>;
    listUsers(): Promise<Array<User>>;
    listUsersWithRoles(): Promise<Array<UserRoleView>>;
    revokeAdminRole(target: UserId): Promise<UserRoleView>;
    schema(): Promise<string>;
    updateTournament(id: bigint, input: TournamentInput): Promise<Tournament>;
    updateUser(userId: UserId, input: UserInput): Promise<User>;
}
