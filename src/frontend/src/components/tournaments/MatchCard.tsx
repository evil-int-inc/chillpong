import {
  BRACKET_LABELS,
  type TournamentMatchView,
  type TournamentPlayerView,
  matchLabel,
  playerById,
  registrationLabel,
  sourceLabel,
} from "@/types/tournament-manager";
import { ArrowUpRight, Flag, Table2 } from "lucide-react";

interface MatchCardProps {
  match: TournamentMatchView;
  players: TournamentPlayerView[];
  matches: TournamentMatchView[];
  onSelect: (match: TournamentMatchView) => void;
  compact?: boolean;
}

export function MatchCard({
  match,
  players,
  matches,
  onSelect,
  compact = false,
}: MatchCardProps) {
  const sides = [
    {
      id: match.playerAId,
      source: match.sourceA,
      score: match.scoreA,
      slot: "a",
    },
    {
      id: match.playerBId,
      source: match.sourceB,
      score: match.scoreB,
      slot: "b",
    },
  ];
  return (
    <button
      type="button"
      data-ocid={`match.card.${match.id}`}
      className={`match-card group block w-full border bg-base-200 text-left transition-colors hover:border-primary/60 ${match.status === "playing" ? "border-secondary/65" : match.status === "ready" ? "border-primary/45" : "border-base-300"} ${compact ? "h-[148px] p-3" : "p-5"}`}
      onClick={() => onSelect(match)}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="technical-label flex items-center gap-2 text-[9px] text-base-content/45">
          {compact
            ? matchLabel(match)
            : `${BRACKET_LABELS[match.bracket]} / R${match.round}`}
          {compact && (match.manualOverride || match.prioritized) ? (
            <span title="Manual override" className="text-secondary">
              <Flag className="size-3" aria-hidden="true" />
              <span className="sr-only">Manual override</span>
            </span>
          ) : null}
        </span>
        <span
          className={`technical-label flex items-center gap-1 text-[9px] ${match.status === "playing" ? "text-secondary" : "text-primary"}`}
        >
          {match.table ? (
            <>
              <Table2 className="size-3" aria-hidden="true" /> T{match.table} /{" "}
              {match.status}
            </>
          ) : match.status === "completed" ? (
            "Final"
          ) : match.status === "bye" ? (
            "BYE"
          ) : match.status === "void" ? (
            "Voided"
          ) : match.status === "ready" ? (
            "Ready"
          ) : (
            "Waiting"
          )}
        </span>
      </div>
      <div className="space-y-2">
        {sides.map((side) => {
          const player = playerById(players, side.id);
          const winner = side.id !== undefined && match.winnerId === side.id;
          return (
            <div
              key={side.slot}
              className={`flex items-center justify-between gap-3 ${winner ? "text-primary" : player ? "text-base-content" : "text-base-content/35"}`}
            >
              <div className="min-w-0">
                <p
                  className={`truncate font-display font-bold ${compact ? "text-sm" : "text-lg"}`}
                >
                  {player?.name ?? sourceLabel(side.source, matches)}
                </p>
                {player ? (
                  <p className="mt-0.5 font-mono text-[9px] font-normal text-base-content/45">
                    L{player.skill} /{" "}
                    {registrationLabel(player.registrationNumber)}
                  </p>
                ) : (
                  <p className="mt-0.5 font-mono text-[9px] text-base-content/25">
                    {side.source.kind === "bye"
                      ? "Automatic advance"
                      : "Bracket dependency"}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 font-mono ${compact ? "text-lg" : "text-2xl"}`}
              >
                {side.score ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
      {!compact ? (
        <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-3">
          <span className="technical-label text-[9px] text-base-content/40">
            {matchLabel(match)} / {match.status}
          </span>
          {match.manualOverride || match.prioritized ? (
            <span className="technical-label flex items-center gap-1 text-[8px] text-secondary">
              <Flag className="size-3" aria-hidden="true" /> Manual override
            </span>
          ) : (
            <ArrowUpRight
              className="size-3.5 text-base-content/35 group-hover:text-primary"
              aria-hidden="true"
            />
          )}
        </div>
      ) : null}
    </button>
  );
}
