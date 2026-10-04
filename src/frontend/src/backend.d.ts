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
export interface TournamentInput {
    status: TournamentStatus;
    title: string;
    venue: string;
    startsAt: Timestamp;
    description: string;
    capacity: bigint;
    format: TournamentFormat;
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
export enum TournamentFormat {
    doubles = "doubles",
    singles = "singles"
}
export enum TournamentStatus {
    upcoming = "upcoming",
    live = "live",
    completed = "completed"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
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
