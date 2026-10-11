import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n";
import {
  type TournamentManagerView,
  matchLabel,
  playerById,
} from "@/types/tournament-manager";
import { useEffect, useState } from "react";

interface TableAssignmentProps {
  view: TournamentManagerView;
  table: TournamentManagerView["tables"][number];
  pending: boolean;
  onAssign: (matchId: bigint, table?: number) => void;
}

export function TableAssignment({
  view,
  table,
  pending,
  onAssign,
}: TableAssignmentProps) {
  const { t } = useI18n();
  const candidates = view.matches.filter(
    (match) =>
      (match.status === "ready" || match.status === "playing") &&
      match.playerAId !== undefined &&
      match.playerBId !== undefined,
  );
  const current = candidates.find((match) => match.id === table.matchId);
  const currentId = current?.id.toString() ?? "";
  const [selectedId, setSelectedId] = useState(currentId);
  const selected = candidates.find(
    (match) => match.id.toString() === selectedId,
  );
  const selectionAvailable = selectedId === "" || !!selected;
  useEffect(() => {
    setSelectedId(currentId);
  }, [currentId]);
  useEffect(() => {
    if (!selectionAvailable) setSelectedId(currentId);
  }, [currentId, selectionAvailable]);
  const changed = selectedId !== currentId;
  const otherTable =
    selected?.table !== undefined && selected.table !== table.number
      ? selected.table
      : undefined;

  return (
    <form
      className="mt-4 space-y-3 border-t border-base-300 pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || !changed || !selectionAvailable) return;
        if (selected) onAssign(selected.id, table.number);
        else if (current) onAssign(current.id, undefined);
      }}
    >
      <label className="block">
        <span className="technical-label mb-2 block text-[10px]">
          {t("Match for table {v1}", { v1: table.number })}
        </span>
        <select
          data-ocid={`tournament.table_match_select.${table.number}`}
          className="select w-full min-w-0 rounded-none"
          value={selectedId}
          disabled={pending || !candidates.length}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">{t("No match / clear table")}</option>
          {candidates.map((match) => (
            <option key={match.id.toString()} value={match.id.toString()}>
              {matchLabel(match)} /{" "}
              {playerById(view.players, match.playerAId)?.name} {t("vs")}{" "}
              {playerById(view.players, match.playerBId)?.name} /{" "}
              {t(match.status)}
              {match.table !== undefined
                ? ` / ${t("Table")} ${match.table}`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-base-content/45">
        {t(
          "Choose any ready or playing match. Assigning a ready match does not start it.",
        )}
      </p>
      {changed && current ? (
        <output className="block text-xs leading-relaxed text-secondary">
          {otherTable !== undefined
            ? t("Table assignments will be exchanged with table {v1}.", {
                v1: otherTable,
              })
            : t(
                "The current match returns to ready without a table. Results and bracket progress are preserved.",
              )}
        </output>
      ) : changed && otherTable !== undefined ? (
        <output className="block text-xs leading-relaxed text-secondary">
          {t("Moving this match frees table {v1}.", { v1: otherTable })}
        </output>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        data-ocid={`tournament.table_match_apply.${table.number}`}
        aria-label={t("Apply assignment to table {v1}", { v1: table.number })}
        loading={pending}
        disabled={!changed || !selectionAvailable}
      >
        {t("Apply assignment")}
      </Button>
    </form>
  );
}
