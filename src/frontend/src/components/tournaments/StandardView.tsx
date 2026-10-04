import { Button } from "@/components/ui/Button";
import {
  type TournamentManagerView,
  type TournamentMatchView,
  playerById,
  registrationLabel,
  tbilisiTime,
} from "@/types/tournament-manager";
import { ArrowRight, Clock3, Table2, Users } from "lucide-react";
import { MatchCard } from "./MatchCard";

interface StandardViewProps {
  view: TournamentManagerView;
  isAdmin: boolean;
  pending: boolean;
  onSelect: (match: TournamentMatchView) => void;
  onAssign: (matchId: bigint, table: number) => void;
}

export function StandardView({
  view,
  isAdmin,
  pending,
  onSelect,
  onAssign,
}: StandardViewProps) {
  const next = view.nextMatches
    .map((id) => view.matches.find((match) => match.id === id))
    .filter((match): match is TournamentMatchView => !!match)
    .slice(0, 5);
  const queue = view.waitingQueue
    .map((id) => playerById(view.players, id))
    .filter((player) => player !== undefined);
  const nextUnassigned = next.find((match) => match.table === undefined);
  return (
    <div className="space-y-10">
      <section aria-labelledby="floor-title">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2
            id="floor-title"
            className="font-display text-xl font-bold uppercase"
          >
            On the floor
          </h2>
          <span className="technical-label text-[10px] text-base-content/40">
            {view.tableCount}{" "}
            {view.tableCount === 1 ? "physical table" : "physical tables"}
          </span>
        </header>
        <div
          data-ocid="tournament.tables"
          className="table-floor grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
        >
          {view.tables.map((table) => {
            const match = view.matches.find(
              (item) => item.id === table.matchId,
            );
            const available =
              table.status === "available" || table.status === "finished";
            return (
              <article
                key={table.number}
                className="border border-base-300 bg-base-200/20 p-4"
              >
                <header className="mb-4 flex items-center justify-between">
                  <h3 className="technical-label flex items-center gap-2">
                    <Table2
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />{" "}
                    Table {table.number}
                  </h3>
                  <span
                    className={`technical-label text-[9px] ${table.status === "playing" ? "text-secondary" : "text-base-content/40"}`}
                  >
                    {table.status}
                  </span>
                </header>
                {match ? (
                  <MatchCard
                    match={match}
                    players={view.players}
                    matches={view.matches}
                    onSelect={onSelect}
                  />
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-base-300 text-center">
                    <Table2
                      className="mb-3 size-7 text-base-content/20"
                      aria-hidden="true"
                    />
                    <p className="font-display text-lg font-bold uppercase">
                      Table is clear.
                    </p>
                    <p className="mt-1 text-xs text-base-content/40">
                      {view.generated
                        ? "Ready for the next rally."
                        : "Waiting for the tournament draw."}
                    </p>
                  </div>
                )}
                {isAdmin && available && nextUnassigned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    loading={pending}
                    onClick={() => onAssign(nextUnassigned.id, table.number)}
                  >
                    Assign next match{" "}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                    <span className="sr-only"> to table {table.number}</span>
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="next-title">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="next-title"
            className="font-display text-xl font-bold uppercase"
          >
            Next matches
          </h2>
          <p className="technical-label text-[9px] text-base-content/40">
            Skill compatibility → registration order → bracket availability
          </p>
        </header>
        {next.length ? (
          <div
            data-ocid="tournament.next_matches"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {next.map((match, index) => (
              <div key={match.id.toString()}>
                <p
                  className={`technical-label mb-2 text-[10px] ${index === 0 ? "text-primary" : "text-base-content/40"}`}
                >
                  {
                    ["Next", "Following", "Then", "After that", "On deck"][
                      index
                    ]
                  }
                </p>
                <MatchCard
                  match={match}
                  players={view.players}
                  matches={view.matches}
                  onSelect={onSelect}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 border border-dashed border-base-300 p-6">
            <Clock3
              className="mt-0.5 size-5 shrink-0 text-base-content/35"
              aria-hidden="true"
            />
            <div>
              <p className="font-display font-bold uppercase">
                {view.complete
                  ? "The night has a winner."
                  : "No decided matches waiting."}
              </p>
              <p className="mt-1 text-sm text-base-content/45">
                {view.complete
                  ? "The complete results are in the full bracket."
                  : view.generated
                    ? "Upcoming pairings appear as their bracket dependencies finish."
                    : "Add players and generate the bracket to decide the first games."}
              </p>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="queue-title">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2
            id="queue-title"
            className="font-display text-xl font-bold uppercase"
          >
            Waiting queue / next to play
          </h2>
          <span className="technical-label text-[10px] text-base-content/40">
            {queue.length} waiting
          </span>
        </header>
        <p className="mb-4 text-xs leading-relaxed text-base-content/45">
          Original registration numbers stay fixed between rounds. Manual
          priority is shown in the organizer history.
        </p>
        {queue.length ? (
          <ol
            data-ocid="tournament.waiting_queue"
            className="grid divide-y divide-base-300 border-y border-base-300"
          >
            {queue.map((player, index) => (
              <li
                key={player.id.toString()}
                className="flex flex-wrap items-center gap-4 py-4"
              >
                <span className="w-5 font-mono text-[10px] text-base-content/25">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span className="w-12 font-mono text-xs text-primary">
                  {registrationLabel(player.registrationNumber)}
                </span>
                <span className="min-w-0 flex-1 break-words font-display font-bold">
                  {player.name}
                </span>
                <span className="technical-label border border-base-300 px-2 py-1 text-[10px]">
                  L{player.skill}
                </span>
                <span className="font-mono text-[10px] text-base-content/40">
                  Registered {tbilisiTime(player.registeredAt)}
                </span>
                <span className="technical-label text-[9px] text-base-content/35">
                  {player.status}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-3 border border-dashed border-base-300 p-6 text-sm text-base-content/45">
            <Users className="size-5" aria-hidden="true" />
            {view.players.length
              ? "Everyone is playing, advanced or finished."
              : "The lineup is open. Players join the queue when registered."}
          </div>
        )}
      </section>
    </div>
  );
}
