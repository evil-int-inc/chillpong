import { useI18n } from "@/i18n";
import {
  BRACKET_LABELS,
  type BracketLane,
  type TournamentMatchView,
  type TournamentPlayerView,
} from "@/types/tournament-manager";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MatchCard } from "./MatchCard";

const CARD_WIDTH = 248;
const CARD_HEIGHT = 148;
const COLUMN_WIDTH = 316;
const ROW_HEIGHT = 184;
const LANES: BracketLane[] = ["winners", "losers", "grandFinal", "resetFinal"];

interface BracketGraphProps {
  matches: TournamentMatchView[];
  players: TournamentPlayerView[];
  onSelect: (match: TournamentMatchView) => void;
}

export function BracketGraph({
  matches,
  players,
  onSelect,
}: BracketGraphProps) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const endPan = useCallback((pointerId?: number) => {
    const pan = panRef.current;
    if (!pan || (pointerId !== undefined && pan.pointerId !== pointerId))
      return;
    panRef.current = null;
    setIsPanning(false);
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture(pan.pointerId))
      viewport.releasePointerCapture(pan.pointerId);
  }, []);

  useEffect(() => {
    function handleBlur() {
      endPan();
    }
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [endPan]);

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

  if (!matches.length) {
    return (
      <div className="club-state">
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
    <section aria-label={t("Complete tournament bracket")}>
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
          <span>{t("Drag or scroll to pan / select any match")}</span>
        </div>
        <div className="flex items-center gap-2 border border-base-300 p-1">
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            aria-label={t("Zoom bracket out")}
            disabled={zoom <= 0.1}
            onClick={() =>
              setZoom((value) =>
                Math.max(0.1, Math.round((value - 0.1) * 10) / 10),
              )
            }
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
            disabled={zoom >= 1.6}
            onClick={() =>
              setZoom((value) =>
                Math.min(1.6, Math.round((value + 0.1) * 10) / 10),
              )
            }
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs font-mono text-[9px]"
            onClick={() => {
              const viewport = viewportRef.current;
              if (!viewport?.clientWidth || !viewport.clientHeight) return;
              setZoom(
                Math.max(
                  0.05,
                  Math.min(
                    1.6,
                    viewport.clientWidth / layout.width,
                    viewport.clientHeight / layout.height,
                  ),
                ),
              );
              viewport.scrollTo({ top: 0, left: 0 });
            }}
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />{" "}
            {t("Fit bracket")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            aria-label={t("Reset bracket zoom")}
            onClick={() => setZoom(1)}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        data-ocid="tournament.bracket"
        data-panning={isPanning || undefined}
        className="bracket-viewport max-h-[75vh] overflow-auto border border-base-300 bg-base-100"
        aria-label={t("Scrollable bracket graph")}
        onPointerDown={(event) => {
          if (
            event.pointerType !== "mouse" ||
            event.button !== 0 ||
            !event.isPrimary
          )
            return;
          suppressClickRef.current = false;
          panRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
            dragging: false,
          };
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (!pan || pan.pointerId !== event.pointerId) return;
          if (!(event.buttons & 1)) {
            endPan(event.pointerId);
            return;
          }
          const dx = event.clientX - pan.x;
          const dy = event.clientY - pan.y;
          if (!pan.dragging) {
            if (Math.hypot(dx, dy) < 4) return;
            pan.dragging = true;
            suppressClickRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsPanning(true);
          }
          event.preventDefault();
          event.currentTarget.scrollLeft = pan.left - dx;
          event.currentTarget.scrollTop = pan.top - dy;
        }}
        onPointerUp={(event) => endPan(event.pointerId)}
        onPointerCancel={(event) => endPan(event.pointerId)}
        onLostPointerCapture={(event) => endPan(event.pointerId)}
        onClickCapture={(event) => {
          if (suppressClickRef.current && event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
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
                className="absolute"
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
