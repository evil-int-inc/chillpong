import { Button } from "@/components/ui/Button";
import {
  DEFAULT_PLAYER_FILTERS,
  PLAYER_STATUSES,
  type PlayerFilters,
  type PlayerSort,
  currentPlayerMatch,
  roundKey,
  roundLabel,
  selectPlayers,
} from "@/types/player-filters";
import {
  SKILL_LEVELS,
  type TournamentManagerView,
  type TournamentPlayerView,
  matchLabel,
  playerMovement,
  registrationLabel,
  tbilisiTime,
} from "@/types/tournament-manager";
import { ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";

interface PlayersPanelProps {
  view: TournamentManagerView;
  isAdmin: boolean;
  pending: boolean;
  onAdd: () => void;
  onEdit: (player: TournamentPlayerView) => void;
  onRemove: (player: TournamentPlayerView) => void;
  onPrioritize: (player: TournamentPlayerView) => void;
  onMove: (player: TournamentPlayerView) => void;
  standalone?: boolean;
}

export function PlayersPanel({
  view,
  isAdmin,
  pending,
  onAdd,
  onEdit,
  onRemove,
  onPrioritize,
  onMove,
  standalone = false,
}: PlayersPanelProps) {
  const [filters, setFilters] = useState<PlayerFilters>(DEFAULT_PLAYER_FILTERS);
  const players = selectPlayers(view, filters);
  const rounds = [
    ...new Map(view.matches.map((match) => [roundKey(match), match])).values(),
  ];
  const filtered =
    filters.search !== "" ||
    filters.skill !== "all" ||
    filters.status !== "all" ||
    filters.table !== "all" ||
    filters.round !== "all";
  return (
    <section
      aria-labelledby="players-title"
      className={standalone ? "mt-6" : "mt-12 border-t border-base-300 pt-8"}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={standalone ? "sr-only" : "section-kicker mb-2"}>
            THE LINEUP / PERMANENT REGISTRATION
          </p>
          <h2
            id="players-title"
            className={
              standalone
                ? "technical-label text-base-content/60"
                : "font-display text-2xl font-bold uppercase"
            }
          >
            Players{" "}
            <span className="font-mono text-sm font-normal text-base-content/30">
              /
              {
                view.players.filter((player) => player.status !== "removed")
                  .length
              }
            </span>
          </h2>
        </div>
        {isAdmin ? (
          <Button data-ocid="tournament.add_player_button" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" /> Add player
          </Button>
        ) : null}
      </header>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <label className="club-search flex w-full items-center gap-3 border border-base-300 px-3 sm:w-80">
          <Search className="size-4 text-base-content/40" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search tournament players"
            placeholder="NAME / REGISTRATION NUMBER"
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-base-content/35"
            value={filters.search}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                search: event.target.value,
              }))
            }
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-base-content/45">
          <input
            type="checkbox"
            className="checkbox checkbox-xs rounded-none"
            checked={filters.showRemoved}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                showRemoved: event.target.checked,
                status:
                  !event.target.checked && previous.status === "removed"
                    ? "all"
                    : previous.status,
              }))
            }
          />{" "}
          Include removed players
        </label>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            Skill level
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.skill}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                skill: event.target.value,
              }))
            }
          >
            <option value="all">All skill levels</option>
            {SKILL_LEVELS.map((level, index) => (
              <option key={level} value={index + 1}>
                L{index + 1} / {level}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            Status
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.status}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                status: event.target.value,
                showRemoved:
                  event.target.value === "removed" || previous.showRemoved,
              }))
            }
          >
            <option value="all">All statuses</option>
            {PLAYER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            Table
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.table}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                table: event.target.value,
              }))
            }
          >
            <option value="all">All tables</option>
            <option value="none">No table assigned</option>
            {view.tables.map((table) => (
              <option key={table.number} value={table.number}>
                Table {table.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            Current round
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.round}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                round: event.target.value,
              }))
            }
          >
            <option value="all">All rounds</option>
            <option value="none">No current round</option>
            {rounds.map((match) => (
              <option key={roundKey(match)} value={roundKey(match)}>
                {roundLabel(match)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className="technical-label mb-2 block text-primary">
            Sort by
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.sort}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                sort: event.target.value as PlayerSort,
              }))
            }
          >
            <option value="registration">Registration order</option>
            <option value="name">Name / A–Z</option>
            <option value="skill">Skill level / L1–L5</option>
            <option value="status">Status / live first</option>
          </select>
        </label>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className="font-mono text-[10px] text-base-content/45"
          aria-live="polite"
        >
          {players.length} /{" "}
          {
            view.players.filter(
              (player) => filters.showRemoved || player.status !== "removed",
            ).length
          }{" "}
          players · Original registration numbers and times stay fixed.
        </p>
        {filtered || filters.sort !== "registration" ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setFilters(DEFAULT_PLAYER_FILTERS)}
          >
            Reset filters & sort
          </button>
        ) : null}
      </div>
      {players.length ? (
        <div className="overflow-x-auto border-y border-base-300">
          <table
            data-ocid="tournament.players_table"
            className="w-full min-w-[760px] text-left"
          >
            <thead>
              <tr className="border-b border-base-300">
                <th
                  scope="col"
                  className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                >
                  Reg / time
                </th>
                <th
                  scope="col"
                  className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                >
                  Player
                </th>
                <th
                  scope="col"
                  className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                >
                  Skill
                </th>
                <th
                  scope="col"
                  className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                >
                  Status / losses
                </th>
                <th
                  scope="col"
                  className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                >
                  Match / table / seed
                </th>
                {isAdmin ? (
                  <th
                    scope="col"
                    className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                  >
                    Organizer controls
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const match = currentPlayerMatch(view, player);
                const canPrioritize =
                  player.status === "waiting" ||
                  player.status === "ready" ||
                  player.status === "advanced";
                return (
                  <tr
                    key={player.id.toString()}
                    className={`player-row border-b border-base-300/70 last:border-b-0 ${player.status === "removed" ? "opacity-40" : ""}`}
                  >
                    <td className="px-3 py-4">
                      <p className="font-mono text-xs text-primary">
                        {registrationLabel(player.registrationNumber)}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-base-content/40">
                        {tbilisiTime(player.registeredAt)}
                      </p>
                    </td>
                    <th
                      scope="row"
                      className="max-w-64 break-words px-3 py-4 font-display text-sm font-bold"
                    >
                      {player.name}
                    </th>
                    <td className="px-3 py-4">
                      <p className="font-mono text-xs">L{player.skill}</p>
                      <p className="mt-1 text-[10px] text-base-content/40">
                        {SKILL_LEVELS[player.skill - 1]}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p
                        className={`technical-label text-[9px] ${player.status === "champion" ? "text-primary" : player.status === "playing" ? "text-secondary" : "text-base-content/60"}`}
                      >
                        {player.status}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-base-content/35">
                        {player.losses}{" "}
                        {player.losses === 1 ? "loss" : "losses"}
                      </p>
                    </td>
                    <td className="px-3 py-4 font-mono text-[10px] text-base-content/45">
                      {match ? matchLabel(match) : "—"} /{" "}
                      {match?.table ? `T${match.table}` : "—"}
                      {player.seed !== undefined ? (
                        <p className="mt-1">Seed {player.seed.toString()}</p>
                      ) : null}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-square btn-xs"
                            aria-label={`Edit ${player.name}`}
                            disabled={pending || player.status === "removed"}
                            onClick={() => onEdit(player)}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-square btn-xs"
                            aria-label={`Prioritize ${player.name} in queue`}
                            disabled={pending || !canPrioritize}
                            onClick={() => onPrioritize(player)}
                          >
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs font-mono text-[9px]"
                            disabled={
                              pending ||
                              !view.generated ||
                              !playerMovement(view, player).targets.length
                            }
                            onClick={() => onMove(player)}
                          >
                            Move<span className="sr-only"> {player.name}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-square btn-xs text-secondary"
                            aria-label={`Remove ${player.name}`}
                            disabled={pending || player.status === "removed"}
                            onClick={() => onRemove(player)}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-base-300 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold uppercase">
            {view.players.length
              ? "No matching players."
              : "An open table. An open lineup."}
          </p>
          <p className="mt-2 text-sm text-base-content/45">
            {view.players.length
              ? "Try another name or adjust the skill, status, table or round filters."
              : "Players added here receive permanent registration numbers and join the queue."}
          </p>
        </div>
      )}
    </section>
  );
}
