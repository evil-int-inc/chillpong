import { useI18n } from "@/i18n";
import { roundKey, roundLabel } from "@/types/player-filters";
import {
  BRACKET_LABELS,
  type BracketLane,
  type MatchStatus,
  type TournamentManagerView,
  type TournamentMatchView,
  matchLabel,
  sourceLabel,
} from "@/types/tournament-manager";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

const MATCH_STATUSES: MatchStatus[] = [
  "playing",
  "ready",
  "pending",
  "completed",
  "bye",
  "void",
];
const BRACKETS: BracketLane[] = [
  "winners",
  "losers",
  "grandFinal",
  "resetFinal",
];
const PAGE_SIZE = 25;
const DEFAULT_FILTERS = {
  search: "",
  status: "all",
  bracket: "all",
  round: "all",
  table: "all",
  sort: "bracket",
};

export function MatchesPanel({
  view,
  onSelect,
}: {
  view: TournamentManagerView;
  onSelect: (match: TournamentMatchView) => void;
}) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const players = useMemo(
    () => new Map(view.players.map((player) => [player.id, player])),
    [view.players],
  );
  function participant(match: TournamentMatchView, side: "a" | "b") {
    const id = side === "a" ? match.playerAId : match.playerBId;
    return (
      (id === undefined ? undefined : players.get(id)?.name) ??
      sourceLabel(side === "a" ? match.sourceA : match.sourceB, view.matches)
    );
  }
  function updateFilter(key: keyof typeof DEFAULT_FILTERS, value: string) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "bracket" ? { round: "all" } : {}),
    }));
    setPage(1);
  }
  const search = filters.search.trim().toLocaleLowerCase(locale);
  const matches = view.matches.filter(
    (match) =>
      (filters.status === "all" || match.status === filters.status) &&
      (filters.bracket === "all" || match.bracket === filters.bracket) &&
      (filters.round === "all" || roundKey(match) === filters.round) &&
      (filters.table === "all" ||
        (filters.table === "none"
          ? match.table === undefined
          : match.table === Number(filters.table))) &&
      (!search ||
        `${matchLabel(match)} M${match.id} #${match.id} ${participant(match, "a")} ${participant(match, "b")}`
          .toLocaleLowerCase(locale)
          .includes(search)),
  );
  if (filters.sort === "status") {
    matches.sort(
      (a, b) =>
        MATCH_STATUSES.indexOf(a.status) - MATCH_STATUSES.indexOf(b.status),
    );
  }
  const rounds = [
    ...new Map(view.matches.map((match) => [roundKey(match), match])).values(),
  ]
    .filter(
      (match) => filters.bracket === "all" || match.bracket === filters.bracket,
    )
    .sort(
      (a, b) =>
        BRACKETS.indexOf(a.bracket) - BRACKETS.indexOf(b.bracket) ||
        a.round - b.round,
    );
  const tables = [
    ...new Set([
      ...view.tables.map((table) => table.number),
      ...view.matches.flatMap((match) =>
        match.table === undefined ? [] : [match.table],
      ),
    ]),
  ].sort((a, b) => a - b);
  const filtered = Object.entries(DEFAULT_FILTERS).some(
    ([key, value]) => filters[key as keyof typeof DEFAULT_FILTERS] !== value,
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = matches.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const titleId = `matches-title-${view.tournament.id}`;
  const cellClass = "block min-w-0 lg:table-cell lg:px-3 lg:py-4";
  const mobileLabelClass =
    "technical-label mb-2 text-[9px] text-base-content/35 lg:hidden";

  return (
    <section
      aria-labelledby={titleId}
      data-ocid="tournament.matches_section"
      className="mt-12 border-t border-base-300 pt-8"
    >
      <header className="mb-5">
        <p className="section-kicker mb-2">{t("THE MATCHES / ALL ROUNDS")}</p>
        <h2 id={titleId} className="font-display text-2xl font-bold uppercase">
          {t("Matches")}{" "}
          <span className="font-mono text-sm font-normal text-base-content/30">
            / {view.matches.length}
          </span>
        </h2>
      </header>
      <label className="club-search mb-5 flex w-full items-center gap-3 border border-base-300 px-3 sm:max-w-md">
        <Search className="size-4 text-base-content/40" aria-hidden="true" />
        <input
          type="search"
          aria-label={t("Search tournament matches")}
          placeholder={t("PLAYER NAME / MATCH ID")}
          className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-base-content/35"
          value={filters.search}
          onChange={(event) => updateFilter("search", event.target.value)}
        />
      </label>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            {t("Match status")}
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="all">{t("All statuses")}</option>
            {MATCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            {t("Bracket")}
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.bracket}
            onChange={(event) => updateFilter("bracket", event.target.value)}
          >
            <option value="all">{t("All brackets")}</option>
            {BRACKETS.map((bracket) => (
              <option key={bracket} value={bracket}>
                {t(BRACKET_LABELS[bracket])}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            {t("Match round")}
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.round}
            onChange={(event) => updateFilter("round", event.target.value)}
          >
            <option value="all">{t("All rounds")}</option>
            {rounds.map((match) => (
              <option key={roundKey(match)} value={roundKey(match)}>
                {roundLabel(match)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="technical-label mb-2 block text-base-content/50">
            {t("Match table")}
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.table}
            onChange={(event) => updateFilter("table", event.target.value)}
          >
            <option value="all">{t("All tables")}</option>
            <option value="none">{t("No table assigned")}</option>
            {tables.map((table) => (
              <option key={table} value={table}>
                {t("Table")} {table}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className="technical-label mb-2 block text-primary">
            {t("Match sort order")}
          </span>
          <select
            className="select w-full rounded-none"
            value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}
          >
            <option value="bracket">{t("Bracket order")}</option>
            <option value="status">{t("Status / live first")}</option>
          </select>
        </label>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className="font-mono text-[10px] text-base-content/45"
          aria-live="polite"
        >
          {t("{shown} of {total} matches", {
            shown: matches.length,
            total: view.matches.length,
          })}
        </p>
        {filtered ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
          >
            {t("Reset filters & sort")}
          </button>
        ) : null}
      </div>
      {visible.length ? (
        <div className="lg:overflow-x-auto lg:border-y lg:border-base-300">
          <table
            data-ocid="tournament.matches_table"
            className="block w-full text-left lg:table lg:min-w-[760px]"
          >
            <thead className="hidden lg:table-header-group">
              <tr className="border-b border-base-300">
                {[
                  "Match",
                  "Players / matchup",
                  "Score",
                  "Status",
                  "Round",
                  "Table",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="technical-label px-3 py-3 text-[9px] font-normal text-base-content/35"
                  >
                    {t(heading)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="grid gap-4 sm:grid-cols-2 lg:table-row-group">
              {visible.map((match) => {
                const playerA = participant(match, "a");
                const playerB = participant(match, "b");
                return (
                  <tr
                    key={match.id.toString()}
                    data-ocid={`match.row.${match.id}`}
                    className="grid min-w-0 cursor-pointer grid-cols-2 gap-x-4 gap-y-4 border border-base-300 bg-base-200/30 p-4 transition-colors hover:bg-primary/5 focus-within:bg-primary/5 lg:table-row lg:border-x-0 lg:border-t-0 lg:border-b-base-300/70 lg:bg-transparent lg:p-0 lg:last:border-b-0"
                    tabIndex={0}
                    onClick={() => onSelect(match)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        onSelect(match);
                      }
                    }}
                  >
                    <th
                      scope="row"
                      className={`${cellClass} col-span-2 font-normal`}
                    >
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-mono text-xs text-primary lg:min-h-8"
                        aria-label={t(
                          "Open match {match}: {playerA} vs {playerB}",
                          {
                            match: `${matchLabel(match)} / M${match.id}`,
                            playerA,
                            playerB,
                          },
                        )}
                      >
                        <span>
                          {matchLabel(match)}
                          <span className="ml-2 text-[10px] text-base-content/40">
                            M{match.id.toString()}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                    <td className={`${cellClass} col-span-2 lg:max-w-72`}>
                      <p className={mobileLabelClass} aria-hidden="true">
                        {t("Players / matchup")}
                      </p>
                      {(["a", "b"] as const).map((side) => {
                        const id =
                          side === "a" ? match.playerAId : match.playerBId;
                        const winner =
                          id !== undefined && match.winnerId === id;
                        return (
                          <p
                            key={side}
                            className={`break-words font-display text-sm font-bold ${winner ? "text-primary" : id === undefined ? "text-base-content/40" : "text-base-content"}`}
                          >
                            {side === "a" ? playerA : playerB}
                          </p>
                        );
                      })}
                    </td>
                    <td className={cellClass}>
                      <p className={mobileLabelClass} aria-hidden="true">
                        {t("Score")}
                      </p>
                      <span className="whitespace-nowrap font-mono text-sm">
                        {match.scoreA ?? "—"} : {match.scoreB ?? "—"}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <p className={mobileLabelClass} aria-hidden="true">
                        {t("Status")}
                      </p>
                      <span
                        className={`technical-label text-[10px] ${match.status === "playing" ? "text-secondary" : match.status === "ready" || match.status === "completed" ? "text-primary" : "text-base-content/45"}`}
                      >
                        {t(match.status)}
                      </span>
                    </td>
                    <td
                      className={`${cellClass} font-mono text-[10px] text-base-content/45`}
                    >
                      <p className={mobileLabelClass} aria-hidden="true">
                        {t("Round")}
                      </p>
                      {roundLabel(match)}
                    </td>
                    <td className={`${cellClass} font-mono text-xs`}>
                      <p className={mobileLabelClass} aria-hidden="true">
                        {t("Table")}
                      </p>
                      {match.table === undefined ? "—" : `T${match.table}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-base-300 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold uppercase">
            {t(
              view.matches.length ? "No matching matches." : "No matches yet.",
            )}
          </p>
          <p className="mt-2 text-sm text-base-content/45">
            {t(
              view.matches.length
                ? "Try another player or adjust the status, bracket, round or table filters."
                : "Generate the bracket to see tournament matches here.",
            )}
          </p>
        </div>
      )}
      {matches.length > PAGE_SIZE ? (
        <nav
          aria-label={t("Matches")}
          className="mt-5 flex items-center justify-between gap-3"
        >
          <button
            type="button"
            className="btn btn-ghost min-h-11 rounded-none"
            aria-label={t("Previous matches page")}
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("Previous")}
          </button>
          <p
            className="font-mono text-[10px] text-base-content/45"
            aria-live="polite"
          >
            {t("Page {page} of {pages}", {
              page: currentPage,
              pages: pageCount,
            })}
          </p>
          <button
            type="button"
            className="btn btn-ghost min-h-11 rounded-none"
            aria-label={t("Next matches page")}
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("Next")}
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
