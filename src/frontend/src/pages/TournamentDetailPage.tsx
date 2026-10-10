import { createActor } from "@/backend";
import { BracketGraph } from "@/components/tournaments/BracketGraph";
import { CopyBracketLink } from "@/components/tournaments/CopyBracketLink";
import { FullscreenBracketFrame } from "@/components/tournaments/FullscreenBracketFrame";
import {
  type ActionOptions,
  OrganizerDialogs,
  type OrganizerModal,
} from "@/components/tournaments/OrganizerDialogs";
import { PlayersPanel } from "@/components/tournaments/PlayersPanel";
import { StandardView } from "@/components/tournaments/StandardView";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { translateError, translateHistory, useI18n } from "@/i18n";
import { formatClubDate } from "@/i18n/date";
import { countLabel } from "@/i18n/plurals";
import {
  type OrganizerAction,
  tournamentManagerService,
} from "@/services/tournament-manager";
import {
  type Elimination,
  type TournamentManagerView,
  playerById,
  tbilisiTime,
} from "@/types/tournament-manager";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Flag,
  GitBranch,
  MapPin,
  Maximize2,
  Plus,
  RefreshCw,
  Table2,
  Trophy,
  Undo2,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";

function OrganizerSetup({
  view,
  pending,
  onAction,
  onOpen,
}: {
  view: TournamentManagerView;
  pending: boolean;
  onAction: (action: OrganizerAction) => void;
  onOpen: (modal: OrganizerModal) => void;
}) {
  const { t } = useI18n();
  const [elimination, setElimination] = useState<Elimination>(view.elimination);
  const [tables, setTables] = useState(view.tableCount.toString());
  const [setupOpen, setSetupOpen] = useState(view.canChangeFormat);
  useEffect(() => {
    setElimination(view.elimination);
    setTables(view.tableCount.toString());
  }, [view.elimination, view.tableCount]);
  useEffect(() => {
    setSetupOpen(view.canChangeFormat);
  }, [view.canChangeFormat]);
  const count = Number(tables);
  const valid = Number.isInteger(count) && count >= 1 && count <= 20;
  const playerCount = view.players.filter(
    (player) => player.status !== "removed",
  ).length;
  return (
    <section
      data-ocid="tournament.organizer_setup"
      className="manager-toolbar mb-8 border border-primary/25 bg-primary/[0.025] p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="technical-label flex items-center gap-2 text-primary">
          <Flag className="size-3.5" aria-hidden="true" /> {t("Organizer desk")}
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          <span
            aria-live="polite"
            className="mr-3 font-mono text-[9px] uppercase tracking-wider text-base-content/35"
          >
            {pending ? t("Saving…") : t("Auto-save on")}
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={setupOpen}
            aria-controls="tournament-setup-fields"
            onClick={() => setSetupOpen((open) => !open)}
          >
            {t("Table setup")}
            <ChevronDown
              className={`size-3.5 transition-transform ${setupOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </Button>
          <Button
            size="sm"
            data-ocid="tournament.undo_button"
            variant="ghost"
            disabled={pending || !view.canUndo}
            onClick={() => onOpen({ kind: "undo" })}
          >
            <Undo2 className="size-3.5" aria-hidden="true" />{" "}
            {t("Undo last action")}
          </Button>
        </div>
      </header>
      <div id="tournament-setup-fields" className="mt-5" hidden={!setupOpen}>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid)
              onAction({
                kind: "configure",
                elimination: view.canChangeFormat
                  ? elimination
                  : view.elimination,
                tableCount: count,
              });
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="technical-label mb-2 block text-[10px]">
              {t("Elimination format")}
            </span>
            <select
              data-ocid="tournament.elimination_select"
              className="select w-full rounded-none"
              value={view.canChangeFormat ? elimination : view.elimination}
              disabled={pending || !view.canChangeFormat}
              onChange={(event) =>
                setElimination(event.target.value as Elimination)
              }
            >
              <option value="single">{t("Single elimination")}</option>
              <option value="double">{t("Double elimination")}</option>
            </select>
          </label>
          <label className="w-36">
            <span className="technical-label mb-2 block text-[10px]">
              {t("Number of tables")}
            </span>
            <input
              data-ocid="tournament.table_count_input"
              type="number"
              className="input w-full rounded-none font-mono"
              min={1}
              max={20}
              step={1}
              required
              value={tables}
              disabled={pending}
              onChange={(event) => setTables(event.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" disabled={pending || !valid}>
            {t("Save setup")}
          </Button>
          <Button
            data-ocid="tournament.generate_button"
            disabled={pending || playerCount < 2 || !view.canChangeFormat}
            onClick={() => onOpen({ kind: "generate" })}
          >
            <GitBranch className="size-4" aria-hidden="true" />
            {view.generated ? t("Regenerate bracket") : t("Generate bracket")}
          </Button>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-base-content/40">
          {view.canChangeFormat
            ? t(
                "Choose the format and 1–20 physical tables before the first match starts. Player registrations survive changes to the unplayed draw.",
              )
            : t(
                "The elimination format is locked after the first match begins. You can still adjust the table count; occupied tables cannot be removed.",
              )}
        </p>
      </div>
    </section>
  );
}

export function TournamentDetailPage({
  tournamentId,
}: { tournamentId: bigint }) {
  const { t } = useI18n();
  const fullscreen = useSearch({
    strict: false,
    select: (search) => search.view === "bracket",
  });
  const navigate = useNavigate();
  const { actor, isFetching } = useActor(createActor);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["tournamentState", tournamentId.toString()] as const;
  const [display, setDisplay] = useState<"standard" | "extended">("standard");
  const changeFullscreen = useCallback(
    (next: boolean) => {
      setDisplay("extended");
      void navigate({
        to: "/tournaments/$tournamentId",
        params: { tournamentId: tournamentId.toString() },
        search: (previous) => ({
          ...previous,
          view: next ? ("bracket" as const) : undefined,
        }),
      });
    },
    [navigate, tournamentId],
  );
  const closeFullscreen = useCallback(
    () => changeFullscreen(false),
    [changeFullscreen],
  );
  useEffect(() => {
    if (fullscreen) setDisplay("extended");
  }, [fullscreen]);
  const [modal, setModal] = useState<OrganizerModal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stateQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!actor) throw new Error("The tournament is still connecting.");
      return tournamentManagerService.get(actor, tournamentId);
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const view = stateQuery.data;
  const actionMutation = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
    },
    mutationFn: async ({
      action,
    }: { action: OrganizerAction; options?: ActionOptions }) => {
      if (!actor || !isAdmin || !view)
        throw new Error("Admin access is required.");
      return tournamentManagerService.apply(
        actor,
        tournamentId,
        action,
        view.tournament,
      );
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKey, updated);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setNotice(
        "Saved to the tournament. The floor, draw and queue are up to date.",
      );
      if (
        variables.action.kind === "addPlayer" &&
        variables.options?.placeNewPlayer
      ) {
        const newPlayer = [...updated.players].sort((a, b) =>
          a.registrationNumber > b.registrationNumber ? -1 : 1,
        )[0];
        if (newPlayer) setModal({ kind: "move", player: newPlayer });
      } else if (variables.options?.close !== false) setModal(null);
    },
  });
  function openModal(next: OrganizerModal) {
    if (!isAdmin && next.kind !== "match") return;
    actionMutation.reset();
    setModal(next);
  }
  function applyAction(action: OrganizerAction, options?: ActionOptions) {
    if (!isAdmin || actionMutation.isPending) return;
    setNotice(null);
    actionMutation.mutate({ action, options });
  }
  const actionError = actionMutation.isError
    ? actionMutation.error instanceof Error
      ? actionMutation.error.message
      : "This action couldn't be saved. Try again."
    : null;
  const loading = stateQuery.isLoading || (isFetching && !view);
  function frame(content: ReactNode) {
    return fullscreen ? (
      <FullscreenBracketFrame
        tournamentId={tournamentId}
        title={view?.tournament.title}
        onClose={closeFullscreen}
      >
        {content}
      </FullscreenBracketFrame>
    ) : (
      content
    );
  }
  if (loading)
    return frame(
      <div
        className="club-page"
        data-ocid="tournament.loading_state"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mb-8 h-4 w-52 animate-pulse bg-base-300" />
        <div className="mb-8 h-20 w-2/3 animate-pulse bg-base-300" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-60 animate-pulse border border-base-300 bg-base-200"
            />
          ))}
        </div>
        <span className="sr-only">
          {t("Loading the tournament floor and bracket.")}
        </span>
      </div>,
    );
  if (stateQuery.isError)
    return frame(
      <div className="club-page">
        <div
          data-ocid="tournament.error_state"
          role="alert"
          className="club-state"
        >
          <AlertTriangle
            className="mb-4 size-7 text-secondary"
            aria-hidden="true"
          />
          <h1 className="font-display text-3xl font-bold uppercase">
            {t("The match desk is offline.")}
          </h1>
          <p className="mt-3 text-sm text-base-content/50">
            {t("We couldn't load the tournament state.")}
          </p>
          <Button className="mt-6" onClick={() => void stateQuery.refetch()}>
            <RefreshCw className="size-4" aria-hidden="true" /> {t("Try again")}
          </Button>
        </div>
      </div>,
    );
  if (!view)
    return frame(
      <div className="club-page">
        <div className="club-state">
          <h1 className="font-display text-3xl font-bold uppercase">
            {t("Tournament not found.")}
          </h1>
          <Link to="/tournaments" className="btn btn-outline mt-6">
            {t("Back to tournaments")}
          </Link>
        </div>
      </div>,
    );
  const champion = playerById(view.players, view.championId);
  const activePlayers = view.players.filter(
    (player) => player.status !== "removed",
  );
  const overrides = view.matches.some(
    (match) => match.manualOverride || match.prioritized,
  );
  const recentActions = [...view.history]
    .sort((a, b) => (a.id > b.id ? -1 : 1))
    .slice(0, 6);
  const dialogs = (
    <OrganizerDialogs
      view={view}
      modal={modal}
      isAdmin={isAdmin}
      pending={actionMutation.isPending}
      error={actionError}
      onClose={() => {
        if (!actionMutation.isPending) setModal(null);
      }}
      onOpen={openModal}
      onAction={applyAction}
    />
  );
  if (fullscreen)
    return frame(
      <>
        <BracketGraph
          fullscreen
          matches={view.matches}
          players={view.players}
          onSelect={(match) => openModal({ kind: "match", matchId: match.id })}
        />
        {dialogs}
      </>,
    );
  return (
    <div data-ocid="tournament.detail_page" className="club-page">
      <Link
        to="/tournaments"
        className="technical-label mb-8 inline-flex items-center gap-2 text-base-content/45 hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />{" "}
        {t("Tournament board")}
      </Link>
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <p className="section-kicker">
            CHILLPONG / CP {tournamentId.toString().padStart(3, "0")}
          </p>
          <span
            className={`technical-label border px-2 py-1 text-[9px] ${view.complete ? "border-primary/40 text-primary" : !view.canChangeFormat ? "border-secondary/40 text-secondary" : "border-base-300 text-base-content/45"}`}
          >
            {view.complete
              ? t("Completed")
              : !view.canChangeFormat
                ? t("Live")
                : view.generated
                  ? t("Draw ready")
                  : t("Registration open")}
          </span>
        </div>
        <h1 className="break-words font-display text-4xl font-bold uppercase leading-[0.98] tracking-tighter sm:text-5xl lg:text-6xl">
          {view.tournament.title}
        </h1>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs text-base-content/50">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-3.5" aria-hidden="true" />
            {view.tournament.venue}
          </span>
          <span>
            {formatClubDate(
              new Date(Number(view.tournament.startsAt / 1_000_000n)),
              {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Tbilisi",
              },
            )}{" "}
            / {tbilisiTime(view.tournament.startsAt)} {t("Tbilisi")}
          </span>
          <span className="inline-flex items-center gap-2">
            <GitBranch className="size-3.5" aria-hidden="true" />
            {view.elimination === "double"
              ? t("Double elimination")
              : t("Single elimination")}
          </span>
          <span>{countLabel(activePlayers.length, "player")}</span>
          <span className="inline-flex items-center gap-2">
            <Table2 className="size-3.5" aria-hidden="true" />
            {countLabel(view.tableCount, "table")}
          </span>
          {overrides ? (
            <span className="inline-flex items-center gap-1.5 text-secondary">
              <Flag className="size-3" aria-hidden="true" />{" "}
              {t("Manual override")}
            </span>
          ) : null}
        </div>
      </header>
      {champion ? (
        <section className="mb-8 flex items-center gap-5 border border-primary/35 bg-primary/5 p-6">
          <Trophy
            className="size-10 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="technical-label mb-2 text-primary">
              {t("THE FINAL POINT / TOURNAMENT CHAMPION")}
            </p>
            <h2 className="font-display text-3xl font-bold uppercase">
              {champion.name} {t("wins.")}
            </h2>
          </div>
        </section>
      ) : null}
      {isAdmin ? (
        <OrganizerSetup
          view={view}
          pending={actionMutation.isPending}
          onAction={applyAction}
          onOpen={openModal}
        />
      ) : null}
      {notice ? (
        <output
          data-ocid="tournament.saved_state"
          className="mb-6 flex items-center gap-2 border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
        >
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {t(notice)}
        </output>
      ) : null}
      {actionError && !modal ? (
        <p
          role="alert"
          className="mb-6 border border-error/35 px-4 py-3 text-sm text-error"
        >
          {translateError(actionError)}
        </p>
      ) : null}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-base-300 py-4">
        <div className="flex gap-1">
          <button
            type="button"
            data-ocid="tournament.standard_tab"
            aria-label={t("Standard view")}
            aria-pressed={display === "standard"}
            className={`club-filter ${display === "standard" ? "is-active" : ""}`}
            onClick={() => setDisplay("standard")}
          >
            {t("Standard")}{" "}
            <span className="ml-2 hidden font-normal opacity-50 sm:inline">
              {t("/ Live floor")}
            </span>
          </button>
          <button
            type="button"
            data-ocid="tournament.extended_tab"
            aria-label={t("Extended view")}
            aria-pressed={display === "extended"}
            className={`club-filter ${display === "extended" ? "is-active" : ""}`}
            onClick={() => setDisplay("extended")}
          >
            {t("Extended")}{" "}
            <span className="ml-2 hidden font-normal opacity-50 sm:inline">
              {t("/ Full bracket")}
            </span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyBracketLink tournamentId={tournamentId} compact />
          <button
            type="button"
            data-ocid="tournament.open_fullscreen_button"
            className="btn btn-ghost btn-square btn-sm"
            aria-label={t("Open fullscreen bracket")}
            title={t("Open fullscreen bracket")}
            onClick={() => changeFullscreen(true)}
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </button>
          {isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openModal({ kind: "player" })}
            >
              <Plus className="size-3.5" aria-hidden="true" /> {t("Add player")}
            </Button>
          ) : (
            <span className="technical-label text-[9px] text-base-content/35">
              {t("Live tournament / public view")}
            </span>
          )}
        </div>
      </div>
      {display === "standard" ? (
        <StandardView
          view={view}
          isAdmin={isAdmin}
          pending={actionMutation.isPending}
          onSelect={(match) => openModal({ kind: "match", matchId: match.id })}
          onAssign={(matchId, table) =>
            applyAction({ kind: "assignTable", matchId, table })
          }
        />
      ) : (
        <BracketGraph
          matches={view.matches}
          players={view.players}
          onSelect={(match) => openModal({ kind: "match", matchId: match.id })}
        />
      )}
      <PlayersPanel
        view={view}
        isAdmin={isAdmin}
        pending={actionMutation.isPending}
        onAdd={() => openModal({ kind: "player" })}
        onEdit={(player) => openModal({ kind: "player", player })}
        onRemove={(player) => openModal({ kind: "remove", player })}
        onMove={(player) => openModal({ kind: "move", player })}
        onPrioritize={(player) =>
          applyAction({ kind: "prioritizePlayer", playerId: player.id })
        }
      />
      {view.tournament.description ? (
        <section className="mt-8 border-t border-base-300 pt-6">
          <h2 className="technical-label mb-3 text-base-content/45">
            {t("The night / organizer notes")}
          </h2>
          <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-relaxed text-base-content/60">
            {view.tournament.description}
          </p>
        </section>
      ) : null}
      {isAdmin && recentActions.length ? (
        <section className="mt-8 border-t border-base-300 pt-6">
          <h2 className="technical-label mb-4 text-base-content/45">
            {t("Recent organizer actions")}
          </h2>
          <ol className="space-y-3">
            {recentActions.map((action) => (
              <li
                key={action.id.toString()}
                className="flex gap-4 font-mono text-[10px] text-base-content/45"
              >
                <span className="text-base-content/25">
                  {tbilisiTime(action.createdAt)}
                </span>
                <span>{translateHistory(action.label)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {dialogs}
    </div>
  );
}
