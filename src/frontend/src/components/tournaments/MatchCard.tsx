import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { useI18n } from "@/i18n";
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
  dense?: boolean;
  isAdmin?: boolean;
}

export function MatchCard({
  match,
  players,
  matches,
  onSelect,
  compact = false,
  dense = false,
  isAdmin = false,
}: MatchCardProps) {
  const { t } = useI18n();
  const actionLabel =
    match.status === "playing"
      ? t("Enter score")
      : match.status === "completed"
        ? t("Correct the result")
        : t("Manage match");
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
  const border =
    match.status === "playing"
      ? "border-secondary/65"
      : match.status === "ready"
        ? "border-primary/45"
        : "border-base-300";
  const status = match.table ? (
    <>
      <Table2 className="size-3" aria-hidden="true" /> T{match.table} /{" "}
      {t(match.status)}
    </>
  ) : match.status === "completed" ? (
    t("Final")
  ) : match.status === "bye" ? (
    t("BYE")
  ) : match.status === "void" ? (
    t("Voided")
  ) : match.status === "ready" ? (
    t("Ready")
  ) : (
    t("Waiting")
  );
  const override = match.manualOverride || match.prioritized;
  if (dense) {
    return (
      <button
        type="button"
        data-ocid={`match.card.${match.id}`}
        className={`match-card grid h-full w-full grid-rows-2 border bg-base-200 text-left ${border}`}
        onClick={() => onSelect(match)}
      >
        <span className="sr-only">
          {matchLabel(match)} / {status}
          {override ? ` / ${t("Manual override")}` : ""}
        </span>
        {sides.map((side) => {
          const player = playerById(players, side.id);
          const name = player?.name ?? sourceLabel(side.source, matches);
          const winner = side.id !== undefined && match.winnerId === side.id;
          const playerDetails = player
            ? `${name} · ${registrationLabel(player.registrationNumber)} / L${player.skill}`
            : name;
          return (
            <span
              key={side.slot}
              title={playerDetails}
              className={`grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_1.75rem] items-center text-sm ${side.slot === "b" ? "border-t border-base-300" : ""} ${winner ? "bg-primary/10" : "bg-base-content/5"}`}
            >
              <span className="grid h-full place-items-center bg-base-content/5 font-mono text-[10px] text-base-content/60">
                {player?.registrationNumber.toString() ?? "—"}
              </span>
              <span
                className={`min-w-0 truncate px-1.5 ${winner ? "font-semibold text-primary" : player ? "text-base-content" : "text-base-content/60"}`}
              >
                {player ? (
                  <PlayerIdentity
                    player={player}
                    size="xxs"
                    nameClassName="truncate"
                    className="max-w-full gap-1 align-middle"
                  />
                ) : (
                  name
                )}
              </span>
              <span
                className={`grid h-full place-items-center font-mono ${winner && side.score !== undefined ? "bg-primary font-bold text-primary-content" : "bg-base-content/5 text-base-content/80"}`}
              >
                {side.score ?? "—"}
              </span>
            </span>
          );
        })}
        {isAdmin ? <span className="sr-only">{actionLabel}</span> : null}
      </button>
    );
  }
  return (
    <button
      type="button"
      data-ocid={`match.card.${match.id}`}
      className={`match-card group block w-full border bg-base-200 text-left transition-colors hover:border-primary/60 ${border} ${compact ? "h-[148px] p-3" : "p-5"}`}
      onClick={() => onSelect(match)}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="technical-label flex items-center gap-2 text-[9px] text-base-content/45">
          {compact
            ? matchLabel(match)
            : t("{v1} / R{v2}", {
                v1: t(BRACKET_LABELS[match.bracket]),
                v2: match.round,
              })}
          {compact && override ? (
            <span title={t("Manual override")} className="text-secondary">
              <Flag className="size-3" aria-hidden="true" />
              <span className="sr-only">{t("Manual override")}</span>
            </span>
          ) : null}
        </span>
        <span
          className={`technical-label flex items-center gap-1 text-[9px] ${match.status === "playing" ? "text-secondary" : "text-primary"}`}
        >
          {status}
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
                  {player ? (
                    <PlayerIdentity
                      player={player}
                      size={compact ? "xxs" : "xs"}
                      nameClassName="truncate"
                      className="max-w-full"
                    />
                  ) : (
                    sourceLabel(side.source, matches)
                  )}
                </p>
                {player ? (
                  <p className="mt-0.5 font-mono text-[9px] font-normal text-base-content/45">
                    L{player.skill} /{" "}
                    {registrationLabel(player.registrationNumber)}
                  </p>
                ) : (
                  <p className="mt-0.5 font-mono text-[9px] text-base-content/25">
                    {side.source.kind === "bye"
                      ? t("Automatic advance")
                      : t("Bracket dependency")}
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
      {compact && isAdmin ? (
        <p className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase text-primary">
          {actionLabel}
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </p>
      ) : null}
      {!compact ? (
        <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-3">
          <span className="technical-label text-[9px] text-base-content/40">
            {isAdmin
              ? actionLabel
              : `${matchLabel(match)} / ${t(match.status)}`}
          </span>
          {override ? (
            <span className="technical-label flex items-center gap-1 text-[8px] text-secondary">
              <Flag className="size-3" aria-hidden="true" />{" "}
              {t("Manual override")}
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
