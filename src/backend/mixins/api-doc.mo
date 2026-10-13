mixin () {
  public query func getApiDoc() : async Text {
    "# ChillPong Backend API

ChillPong stores the club's users and ping-pong tournaments. Users and tournament
records are public to browse. Admins manage records; authenticated members can
create or edit their own profile through saveCallerProfile().

## Authentication and roles

The authorization mixin provides Internet Identity sign-in and
_initialize_access_control(). The first authenticated registrant receives the
authorization package's admin role; later registrants receive its user role.

App-level roles are null (regular user) or ?{ #admin }. Role management is
admin-only: listUsersWithRoles(), grantAdminRole(principal), and
revokeAdminRole(principal). getMyRole() safely returns null for anonymous or
unregistered visitors.
listUsersWithRoles() lists registered authentication principals even when they
have no profile; role grants and revocations work for those accounts too.

For registered accounts, role reads use the authorization package's current
role, including assignments made through assignCallerUserRole(). The same role
projection is used by user reads, the admin directory, and OQL. An unregistered
account falls back to its stored app role. The owner always retains the admin
projection once bootstrap has applied; bootstrap restores their package role.

bootstrapOwner() captures its first authenticated admin caller as owner and mirrors their
authorization-package admin role onto their User record. Register the owner with
_initialize_access_control() before calling it. Repeated calls preserve owner
admin access, including after upgrades and package-role drift; the owner's role
cannot be revoked through the app's role-management API.
A user record created for an already registered admin receives the app admin role.

## Users

- listUsers() : [User] — public, newest first.
- getUser(principal) : ?User — public.
- getUserByUsername(username) : ?User — public.
- getCallerProfile() : ?User — the caller's record, or null.
- saveCallerProfile(input : ProfileInput) : User — authenticated, own account only.
- createUser(principal, input : UserInput) : User — admin-only.
- updateUser(principal, input : UserInput) : User — admin-only.

UserInput contains displayName, username, and bio : ?Text. Display names are
optional, trimmed, and limited to 80 characters. Usernames are optional; when
provided they are trimmed, lowercased, unique, and contain 3–30 ASCII letters,
digits, underscores, or hyphens. Empty usernames share no index entry and cannot
be looked up. ProfileInput contains only displayName and username; empty text
clears either optional field. Self-service saves preserve the principal, avatar,
bio, creation time, and effective role. Bios
are optional and limited to 500 characters. Anonymous principals cannot be users.
Updates preserve the principal, avatar, creation time, and role. Existing avatar
references remain ExternalBlob values supported by the object-storage mixin.

Existing handles are preserved during upgrade. Username lookup and new-handle
uniqueness compare trimmed, case-folded values as well as the legacy exact index.
An unchanged legacy handle remains valid on update even if it predates the new
handle format. If two older handles already differ only by case, exact spelling
selects the exact record; principal reads always identify accounts unambiguously.

## Telegram profile linking

- getTelegramLinkConfig() : { clientId : ?Text } — public Login client ID.
- setTelegramLinkConfig(?Text) : () — admin-only public client ID configuration.
- getCallerTelegramLink() : ?TelegramLink — authenticated caller's link.
- startTelegramLink() : { clientId, nonce, expiresAt } — authenticated caller.
- completeTelegramLink(idToken : Text) : User — authenticated caller.
- unlinkTelegram() : User — authenticated caller.

Linking retains the Internet Identity principal, member account and roles.
The backend verifies Telegram's signed ID token against Telegram's public keys,
including issuer, audience, expiration and the caller's short-lived nonce. A
Telegram account may belong to only one member. An absent Telegram username or
a username reserved by another member rejects atomically. A successful link
replaces the member's username, including an existing manually entered value,
and preserves all other profile metadata. Verified Telegram handles may contain
up to 32 characters. Unlinking removes the Telegram association and retains the
profile username. TelegramLink contains subject, username and linkedAt.
Configuration stores only a public client ID; the bot token is never stored.

## Shared players

- listPlayers() : [GlobalPlayer] — public club directory, creation order.
- createPlayer({ name, skillLevel }) : GlobalPlayer — admin-only.
- updatePlayer(id, { name, skillLevel }) : GlobalPlayer — admin-only.
- linkPlayerToUser(playerId, principal) : GlobalPlayer — admin-only.
- unlinkPlayerFromUser(playerId) : GlobalPlayer — admin-only.

GlobalPlayer contains id, name, skillLevel, userId : ?Principal, createdAt and
updatedAt. Players are available for registration in every tournament. A member
and player may each have only one active link. Linking requires a principal that
has authenticated, creates a missing optional member profile, and replaces its
displayName with the player's name while preserving username, bio, avatar, role
and creation time. Conflicting links reject; unlink before reassignment.
Unlinking retains the profile name. Updating a linked club player's name also
updates the member's name. Directory edits affect future registrations; names
and skills stored in existing tournaments and undo snapshots stay unchanged.

Legacy tournament entrants migrate into separate global records without merging
matching names. Tournament-local IDs, registrations, matches and scores remain
unchanged. Every local entrant and its historical snapshots retain the same
optional globalPlayerId. Removing or undoing a registration does not delete the
club identity.

## Tournaments

- getTournaments() : [Tournament] — public, start time ascending, then id.
- getTournament(id) : ?Tournament — public.
- createTournament(input : TournamentInput) : Tournament — admin-only.
- updateTournament(id, input : TournamentInput) : Tournament — admin-only.

TournamentInput contains title, description, venue, startsAt, format, capacity,
and status. Titles have 1–100 trimmed characters, venues 1–150, descriptions at
most 2000. startsAt is a positive Int timestamp in nanoseconds since Unix epoch.
capacity is an expected-player planning estimate of at least 2, not an entrant
limit. format is #singles or #doubles; status is #upcoming,
#live, or #completed. Returned records also include id, createdAt, and updatedAt.
Updating preserves id and createdAt. Creates allocate durable sequential ids.

## Tournament organizer

- getTournamentState(id) : ?TournamentState — public persistent room state.
- applyTournamentCommand(id, command) : TournamentState — admin-only.

The command variants configure, addPlayer, addExistingPlayer, editPlayer, removePlayer,
generateBracket, placePlayer, movePlayer, swapPlayers, setMatchPlayers,
assignBye, assignTable, startMatch, recordResult, resetMatch, prioritizeMatch,
prioritizePlayer, and undo control the organizer. Configure chooses
#singleElimination or #doubleElimination and 1–20 tables. Discipline remains
the tournament metadata's independent #singles or #doubles field.

Players have permanent monotonic IDs, registration numbers, and nanosecond
registration times. Names contain 1–80 trimmed characters and skill levels are
1–5. Up to 4096 active entrants are supported. Seeding pairs equal skills in
registration order, then unmatched players with the closest higher skill.
Power-of-two bracket padding awards one-player opening byes to weaker skills,
then earlier registration. Byes advance without counting as a played loss.

addPlayer creates a club identity and tournament registration atomically.
addExistingPlayer({ globalPlayerId }) registers a directory player with a new
tournament-local FIFO ID, snapshotting its current name and skill. A global
player cannot be registered twice in the same tournament, including withdrawn
entries. Registration after undo allocates a fresh local ID. editPlayer remains
a tournament-local, undoable change and does not edit the club directory.

Double elimination has winners and losers brackets, a grand final, and a reset
final when the losers-bracket champion wins the first grand final. Scores cannot
tie. Advancements, eligibility, player loss counts, and table availability derive
from the persistent match dependency graph. Starting requires a free table and
prevents a participant from playing two matches at once. Completed scores free
their table for the next match.

Adding after generation puts a player in the waiting queue. Explicit placement
into an unused winners slot fills it. Placement into an occupied pending winners
slot inserts a qualification match, preserving the original slot source; double
elimination also inserts a losers qualification feed. Previous scored results
and unrelated active matches remain intact. Placement rejects scored or playing
dependencies. Move exchanges the current pending incoming source with its target
within the same winners or losers round, preserving earlier scores and loss
lineage. Eliminated players cannot move back into the bracket. Move, swap,
custom matchup, and manual bye commands also reject
affected scored or playing matches. Custom matchups and manual byes use opening
slots; swaps allow opening slots or ready matches in the same bracket round.

Withdrawal from a bracket requires confirmation, preserves scored results, and
advances remaining opponents without inventing scores. Withdrawal after a scored
final preserves its historical champion and results. Reset rejects playing descendants;
resetting completed descendants requires cascade=true. Same-winner score edits
preserve advancement; changing the winner rejects scored or playing descendants.

The latest 30 accepted actions have immutable undo snapshots. Undo restores
players, bracket, tables, and configuration without reusing registration, match,
or action IDs. State survives upgrades. Generation updates tournament status to
live; champion determination updates it to completed; undo restores lifecycle.
Metadata edits cannot override the lifecycle of a generated bracket.

## Queryable data

schema() and execute(json) expose only the public user and tournament entities.
No video, playlist, subscription, upload-session, notification, or custom
storage-provider tables remain in current state.

## Mutation behavior

Validation and authorization failures reject the mutation and roll back its
writes. User creation rejects duplicate principals and usernames. User updates
reject a username held by another user. Missing update targets reject with
User not found or Tournament not found. Creates are not idempotent: only retry a
known rejection; an uncertain tournament-create response may have committed.
Updates and role grants are safe to repeat with the same values.
"
  };
};
