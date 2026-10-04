mixin () {
  public query func getApiDoc() : async Text {
    "# ChillPong Backend API

ChillPong stores the club's users and ping-pong tournaments. Users and tournament
records are public to browse. Only admins can create or edit either kind of record.

## Authentication and roles

The authorization mixin provides Internet Identity sign-in and
_initialize_access_control(). The first authenticated registrant receives the
authorization package's admin role; later registrants receive its user role.

App-level roles are null (regular user) or ?{ #admin }. Role management is
admin-only: listUsersWithRoles(), grantAdminRole(principal), and
revokeAdminRole(principal). getMyRole() safely returns null for anonymous or
unregistered visitors.

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
- createUser(principal, input : UserInput) : User — admin-only.
- updateUser(principal, input : UserInput) : User — admin-only.

UserInput contains displayName, username, and bio : ?Text. Display names are
trimmed and must contain 1–80 characters. Usernames are trimmed, lowercased,
unique, and contain 3–30 ASCII letters, digits, underscores, or hyphens. Bios
are optional and limited to 500 characters. Anonymous principals cannot be users.
Updates preserve the principal, avatar, creation time, and role. Existing avatar
references remain ExternalBlob values supported by the object-storage mixin.

Existing handles are preserved during upgrade. Username lookup and new-handle
uniqueness compare trimmed, case-folded values as well as the legacy exact index.
An unchanged legacy handle remains valid on update even if it predates the new
handle format. If two older handles already differ only by case, exact spelling
selects the exact record; principal reads always identify accounts unambiguously.

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

The command variants configure, addPlayer, editPlayer, removePlayer,
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
