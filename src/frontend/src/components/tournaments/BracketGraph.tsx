import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { type LocalizedMessage, useI18n } from "@/i18n";
import {
  BRACKET_LABELS,
  type BracketLane,
  type TournamentMatchView,
  type TournamentPlayerView,
  matchLabel,
  registrationLabel,
} from "@/types/tournament-manager";
import { Maximize2, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MatchCard } from "./MatchCard";
import {
  MAX_BRACKET_ZOOM,
  MIN_BRACKET_ZOOM,
  useBracketNavigation,
} from "./useBracketNavigation";

const CARD_WIDTH = 248;
const CARD_HEIGHT = 148;
const COLUMN_WIDTH = 316;
const ROW_HEIGHT = 184;
const LANES: BracketLane[] = ["winners", "losers", "grandFinal", "resetFinal"];

function nextPlayerMatch(
  matches: TournamentMatchView[],
  player: TournamentPlayerView,
) {
  if (["removed", "eliminated", "champion"].includes(player.status)) return;
  const candidates = matches.filter(
    (match) => match.playerAId === player.id || match.playerBId === player.id,
  );
  for (const status of ["playing", "ready", "pending"] as const) {
    const eligible = candidates.filter((match) => match.status === status);
    const next =
      eligible.find((match) => match.id === player.currentMatchId) ??
      eligible[0];
    if (next) return next;
  }
}

function centerMatch(
  viewport: HTMLDivElement,
  layout: { width: number; height: number },
  node: { x: number; y: number },
  zoom: number,
) {
  viewport.scrollLeft = Math.max(
    0,
    Math.min(
      layout.width * zoom - viewport.clientWidth,
      (node.x + CARD_WIDTH / 2) * zoom - viewport.clientWidth / 2,
    ),
  );
  viewport.scrollTop = Math.max(
    0,
    Math.min(
      layout.height * zoom - viewport.clientHeight,
      (node.y + CARD_HEIGHT / 2) * zoom - viewport.clientHeight / 2,
    ),
  );
}

interface BracketGraphProps {
  matches: TournamentMatchView[];
  players: TournamentPlayerView[];
  onSelect: (match: TournamentMatchView) => void;
  fullscreen?: boolean;
  isAdmin?: boolean;
  focusMatchId?: bigint;
}

export function BracketGraph({
  matches,
  players,
  onSelect,
  fullscreen = false,
  isAdmin = false,
  focusMatchId,
}: BracketGraphProps) {
  const { t, locale } = useI18n();
  const [playerSearch, setPlayerSearch] = useState("");
  const [choices, setChoices] = useState<bigint[]>([]);
  const [feedback, setFeedback] = useState<LocalizedMessage | null>(null);
  const [searchFocus, setSearchFocus] = useState<{ matchId: bigint }>();
  const handledSearchRef = useRef<typeof searchFocus>(undefined);
  const searchZoomRef = useRef<{
    request: { matchId: bigint };
    zoom: number;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    viewportRef,
    zoom,
    isPanning,
    zoomTo,
    fitZoom,
    ...navigationHandlers
  } = useBracketNavigation(matches.length > 0);

  const layout = useMemo(() => {
    const nodes: { match: TournamentMatchView; x: number; y: number }[] = [];
    const headings: {
      lane: BracketLane;
      top: number;
      columns: { index: number; caption: string }[];
    }[] = [];
    let top = 28;
    let columns = 1;
    for (const lane of LANES) {
      const laneMatches = matches.filter((match) => match.bracket === lane);
      if (!laneMatches.length) continue;
      const rounds = [...new Set(laneMatches.map((match) => match.round))].sort(
        (a, b) => a - b,
      );
      const laneById = new Map(
        laneMatches.map((match) => [match.id.toString(), match]),
      );
      const depths = new Map<string, number>();
      function depth(
        match: TournamentMatchView,
        visiting = new Set<string>(),
      ): number {
        const id = match.id.toString();
        const saved = depths.get(id);
        if (saved !== undefined) return saved;
        if (visiting.has(id)) return rounds.indexOf(match.round);
        const path = new Set(visiting).add(id);
        const incoming = [match.sourceA, match.sourceB].flatMap((source) => {
          if (source.kind !== "winner" && source.kind !== "loser") return [];
          const parent = laneById.get(source.id.toString());
          return parent ? [depth(parent, path) + 1] : [];
        });
        const result = Math.max(rounds.indexOf(match.round), ...incoming);
        depths.set(id, result);
        return result;
      }
      const columnNumbers = [
        ...new Set(laneMatches.map((match) => depth(match))),
      ].sort((a, b) => a - b);
      const count = Math.max(
        ...columnNumbers.map(
          (column) =>
            laneMatches.filter((match) => depth(match) === column).length,
        ),
      );
      const sectionHeight = Math.max(ROW_HEIGHT, count * ROW_HEIGHT);
      headings.push({
        lane,
        top,
        columns: columnNumbers.map((column) => {
          const groupRounds = [
            ...new Set(
              laneMatches
                .filter((match) => depth(match) === column)
                .map((match) => match.round),
            ),
          ].sort((a, b) => a - b);
          return {
            index: column,
            caption: groupRounds
              .map((round) =>
                round === 0
                  ? t("Qualifiers / round 0")
                  : t("Round {round}", { round }),
              )
              .join(" + "),
          };
        }),
      });
      for (const column of columnNumbers) {
        const roundMatches = laneMatches
          .filter((match) => depth(match) === column)
          .sort((a, b) => a.position - b.position);
        for (const [index, match] of roundMatches.entries()) {
          nodes.push({
            match,
            x: 28 + column * COLUMN_WIDTH,
            y:
              top +
              82 +
              ((index + 0.5) * sectionHeight) / roundMatches.length -
              CARD_HEIGHT / 2,
          });
        }
      }
      columns = Math.max(columns, Math.max(...columnNumbers) + 1);
      top += sectionHeight + 148;
    }
    return {
      nodes,
      headings,
      width: 56 + columns * COLUMN_WIDTH - (COLUMN_WIDTH - CARD_WIDTH),
      height: top,
    };
  }, [matches, t]);
  const byId = new Map(
    layout.nodes.map((node) => [node.match.id.toString(), node]),
  );
  const focusedMatchRef = useRef<bigint | undefined>(undefined);
  useEffect(() => {
    if (focusMatchId === undefined) {
      focusedMatchRef.current = undefined;
      return;
    }
    if (focusedMatchRef.current === focusMatchId) return;
    const node = layout.nodes.find((item) => item.match.id === focusMatchId);
    const viewport = viewportRef.current;
    if (!node || !viewport?.clientWidth || !viewport.clientHeight) return;
    // A manual placement can add columns outside the current viewport. Reveal
    // its new match once, then let subsequent pan/zoom gestures keep their view.
    centerMatch(viewport, layout, node, zoom);
    focusedMatchRef.current = focusMatchId;
  }, [focusMatchId, layout, viewportRef, zoom]);

  useEffect(() => {
    if (!searchFocus || handledSearchRef.current === searchFocus) return;
    const node = layout.nodes.find(
      (item) => item.match.id === searchFocus.matchId,
    );
    const viewport = viewportRef.current;
    if (!node || !viewport) return;
    let observer: ResizeObserver | undefined;
    const reveal = () => {
      if (handledSearchRef.current === searchFocus) return;
      if (!viewport.clientWidth || !viewport.clientHeight) return;
      // Choose the scale once per search. Growing the canvas can add a
      // scrollbar and change clientWidth; recomputing can oscillate forever.
      if (searchZoomRef.current?.request !== searchFocus) {
        searchZoomRef.current = {
          request: searchFocus,
          zoom: Math.max(
            MIN_BRACKET_ZOOM,
            Math.min(
              1.4,
              (viewport.clientWidth - 48) / CARD_WIDTH,
              (viewport.clientHeight - 48) / CARD_HEIGHT,
            ),
          ),
        };
      }
      const targetZoom = searchZoomRef.current.zoom;
      if (zoom !== targetZoom) {
        // Navigation commits the new canvas size before this effect centers
        // the card. Scrolling first would clamp against the old small canvas.
        zoomTo(targetZoom);
        return;
      }
      centerMatch(viewport, layout, node, zoom);
      handledSearchRef.current = searchFocus;
      observer?.disconnect();
    };
    reveal();
    if (
      handledSearchRef.current !== searchFocus &&
      typeof ResizeObserver !== "undefined"
    ) {
      observer = new ResizeObserver(reveal);
      observer.observe(viewport);
    }
    return () => observer?.disconnect();
  }, [searchFocus, layout, viewportRef, zoom, zoomTo]);

  function findNextMatch(playerId: bigint) {
    const player = players.find((item) => item.id === playerId);
    if (!player) {
      setChoices([]);
      setSearchFocus(undefined);
      setFeedback({ message: "No player matches this name.", params: {} });
      return;
    }
    setChoices([]);
    const match = nextPlayerMatch(matches, player);
    if (!match) {
      setSearchFocus(undefined);
      setFeedback({
        message: "No upcoming match for {name}.",
        params: { name: player.name },
      });
      return;
    }
    searchInputRef.current?.blur();
    // A fresh request also refocuses the same player after manual pan/zoom.
    setSearchFocus({ matchId: match.id });
    setFeedback({
      message: "Showing match {match} for {name}.",
      params: {
        match: `${matchLabel(match)} / M${match.id}`,
        name: player.name,
      },
    });
  }

  function searchPlayer() {
    const normalize = (name: string) =>
      name.trim().normalize("NFKC").toLocaleLowerCase(locale);
    const search = normalize(playerSearch);
    if (!search) return;
    const exact = players.filter((player) => normalize(player.name) === search);
    const found = exact.length
      ? exact
      : players.filter((player) => normalize(player.name).includes(search));
    if (found.length === 1) {
      findNextMatch(found[0].id);
    } else {
      setSearchFocus(undefined);
      setChoices(found.map((player) => player.id));
      setFeedback({
        message: found.length
          ? "Several players match. Choose a player below."
          : "No player matches this name.",
        params: {},
      });
    }
  }

  if (!matches.length) {
    return (
      <div className={`club-state${fullscreen ? " flex-1" : ""}`}>
        <p className="font-display text-2xl font-bold uppercase">
          {t("No bracket yet.")}
        </p>
        <p className="mt-3 text-sm text-base-content/50">
          {t(
            "The full tournament tree appears when the organizer generates the bracket.",
          )}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={t("Complete tournament bracket")}
      className={fullscreen ? "flex min-h-0 flex-1 flex-col" : undefined}
    >
      <form
        data-ocid="tournament.bracket_player_search"
        className="mb-4 shrink-0"
        onSubmit={(event) => {
          event.preventDefault();
          searchPlayer();
        }}
      >
        <div className="flex flex-wrap gap-2">
          <label className="club-search flex min-w-0 flex-1 basis-48 items-center gap-3 border border-base-300 px-3">
            <Search
              className="size-4 shrink-0 text-base-content/40"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              aria-label={t("Find a player in the bracket")}
              placeholder={t("PLAYER NAME")}
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-base-content/35"
              value={playerSearch}
              onChange={(event) => {
                setPlayerSearch(event.target.value);
                setChoices([]);
                setFeedback(null);
              }}
            />
          </label>
          <button
            type="submit"
            className="btn min-h-11 rounded-none border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            disabled={!playerSearch.trim()}
          >
            <Search className="size-4" aria-hidden="true" />{" "}
            {t("Find next match")}
          </button>
        </div>
        {feedback ? (
          <output className="mt-2 block text-xs text-base-content/60">
            {t(feedback)}
          </output>
        ) : null}
        {choices.length ? (
          <div className="mt-3 grid max-h-32 gap-2 overflow-auto sm:grid-cols-2">
            {choices.flatMap((id) => {
              const player = players.find((item) => item.id === id);
              if (!player) return [];
              const registration = registrationLabel(player.registrationNumber);
              return [
                <button
                  key={id.toString()}
                  type="button"
                  aria-label={t("Find next match for {name} / {registration}", {
                    name: player.name,
                    registration,
                  })}
                  className="flex min-h-11 items-center justify-between gap-3 border border-base-300 px-3 py-2 text-left hover:border-primary/60"
                  onClick={() => findNextMatch(id)}
                >
                  <span className="min-w-0 break-words font-display text-sm font-bold">
                    <PlayerIdentity
                      player={player}
                      nameClassName="break-words"
                    />
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-base-content/45">
                    {registration} / {t(player.status)}
                  </span>
                </button>,
              ];
            })}
          </div>
        ) : null}
      </form>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-base-content/45">
          <span className="flex items-center gap-2">
            <span
              className="w-5 border-t border-primary/60"
              aria-hidden="true"
            />{" "}
            {t("Winner advances")}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="w-5 border-t border-dashed border-secondary/60"
              aria-hidden="true"
            />{" "}
            {t("Loser drops")}
          </span>
          <span>{t("Drag to pan / scroll or pinch to zoom")}</span>
        </div>
        <div className="flex items-center gap-2 border border-base-300 p-1">
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            aria-label={t("Zoom bracket out")}
            disabled={zoom <= MIN_BRACKET_ZOOM}
            onClick={() => zoomTo(Math.round((zoom - 0.1) * 100) / 100)}
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <output
            className="w-10 text-center font-mono text-[10px]"
            aria-label={t("Bracket zoom")}
          >
            {Math.round(zoom * 100)}%
          </output>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            aria-label={t("Zoom bracket in")}
            disabled={zoom >= MAX_BRACKET_ZOOM}
            onClick={() => zoomTo(Math.round((zoom + 0.1) * 100) / 100)}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs font-mono text-[9px]"
            onClick={() => {
              const viewport = viewportRef.current;
              if (!viewport?.clientWidth || !viewport.clientHeight) return;
              fitZoom(
                Math.min(
                  viewport.clientWidth / layout.width,
                  viewport.clientHeight / layout.height,
                ),
              );
            }}
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />{" "}
            {t("Fit bracket")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            aria-label={t("Reset bracket zoom")}
            onClick={() => zoomTo(1)}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        data-ocid="tournament.bracket"
        data-panning={isPanning || undefined}
        className={`bracket-viewport overflow-auto border border-base-300 bg-base-100 ${fullscreen ? "min-h-0 flex-1" : "max-h-[75vh]"}`}
        aria-label={t("Scrollable bracket graph")}
        {...navigationHandlers}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          className="overflow-hidden"
          style={{ width: layout.width * zoom, height: layout.height * zoom }}
        >
          <div
            className="bracket-canvas relative origin-top-left"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              width={layout.width}
              height={layout.height}
            >
              {layout.nodes.flatMap((node) =>
                [
                  { source: node.match.sourceA, slot: "a", offset: 69 },
                  { source: node.match.sourceB, slot: "b", offset: 111 },
                ].map(({ source, slot, offset }) => {
                  if (source.kind !== "winner" && source.kind !== "loser")
                    return null;
                  const parent = byId.get(source.id.toString());
                  if (!parent) return null;
                  const fromX = parent.x + CARD_WIDTH;
                  const fromY = parent.y + CARD_HEIGHT / 2;
                  const toX = node.x;
                  const toY = node.y + offset;
                  const bend = fromX < toX ? (fromX + toX) / 2 : fromX + 30;
                  const crossLane = parent.match.bracket !== node.match.bracket;
                  return (
                    <path
                      key={`${node.match.id}-${slot}`}
                      d={`M ${fromX} ${fromY} C ${bend} ${fromY}, ${bend} ${toY}, ${toX} ${toY}`}
                      fill="none"
                      stroke={
                        source.kind === "loser"
                          ? "var(--color-secondary)"
                          : "var(--color-primary)"
                      }
                      strokeWidth={1}
                      strokeDasharray={
                        source.kind === "loser" ? "4 5" : undefined
                      }
                      opacity={crossLane ? 0.2 : 0.45}
                    />
                  );
                }),
              )}
            </svg>
            {layout.headings.map((heading) => (
              <div key={heading.lane}>
                <h3
                  className="absolute left-7 font-display text-lg font-bold uppercase tracking-tight"
                  style={{ top: heading.top }}
                >
                  {t(BRACKET_LABELS[heading.lane])}
                  <span className="ml-3 font-mono text-[10px] font-normal text-base-content/30">
                    {heading.lane === "resetFinal"
                      ? t("Only if the unbeaten finalist loses")
                      : heading.lane === "losers"
                        ? t("Second loss = elimination")
                        : ""}
                  </span>
                </h3>
                {heading.columns.map((column) => (
                  <p
                    key={column.index}
                    className="technical-label absolute text-[10px] text-base-content/40"
                    style={{
                      left: 28 + column.index * COLUMN_WIDTH,
                      top: heading.top + 39,
                    }}
                  >
                    {heading.lane === "grandFinal" ||
                    heading.lane === "resetFinal"
                      ? t("Championship")
                      : t(column.caption)}
                  </p>
                ))}
              </div>
            ))}
            {layout.nodes.map((node) => (
              <div
                key={node.match.id.toString()}
                data-focused-match={
                  searchFocus?.matchId === node.match.id || undefined
                }
                className={`absolute ${searchFocus?.matchId === node.match.id ? "ring-2 ring-primary ring-offset-4 ring-offset-base-100" : ""}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                }}
              >
                <MatchCard
                  match={node.match}
                  players={players}
                  matches={matches}
                  onSelect={onSelect}
                  isAdmin={isAdmin}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
