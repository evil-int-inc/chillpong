import { createActor } from "@/backend";
import {
  type ActionOptions,
  OrganizerDialogs,
  type OrganizerModal,
} from "@/components/tournaments/OrganizerDialogs";
import { PlayersPanel } from "@/components/tournaments/PlayersPanel";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { translateError, useI18n } from "@/i18n";
import {
  type OrganizerAction,
  tournamentManagerService,
} from "@/services/tournament-manager";
import { tournamentService } from "@/services/tournaments";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

export function PlayersPage() {
  const { t } = useI18n();
  const { actor, isFetching } = useActor(createActor);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState("");
  const [modal, setModal] = useState<OrganizerModal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => {
      if (!actor) throw new Error("The tournament board is still connecting.");
      return tournamentService.list(actor);
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const tournaments = [...(tournamentsQuery.data ?? [])].sort((a, b) => {
    const order = ["live", "upcoming", "completed", "cancelled"];
    const difference = order.indexOf(a.status) - order.indexOf(b.status);
    if (difference) return difference;
    if (a.startsAt === b.startsAt)
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    return a.status === "upcoming"
      ? a.startsAt < b.startsAt
        ? -1
        : 1
      : a.startsAt > b.startsAt
        ? -1
        : 1;
  });
  const preferredId = tournaments[0]?.id.toString() ?? "";
  const selectionExists = tournaments.some(
    (tournament) => tournament.id.toString() === selected,
  );
  useEffect(() => {
    if (!selectionExists) {
      setSelected(preferredId);
      setModal(null);
      setNotice(null);
    }
  }, [selectionExists, preferredId]);
  const tournament = tournaments.find(
    (item) => item.id.toString() === selected,
  );
  const queryKey = ["tournamentState", selected] as const;
  const stateQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!actor || !tournament) throw new Error("Choose a tournament first.");
      return tournamentManagerService.get(actor, tournament.id);
    },
    enabled: !!actor && !isFetching && !!tournament,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const view = stateQuery.data;
  const mutation = useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
    },
    mutationFn: async ({
      action,
    }: { action: OrganizerAction; options?: ActionOptions }) => {
      if (!actor || !isAdmin || !view || view.tournament.id !== tournament?.id)
        throw new Error("Admin access and a selected tournament are required.");
      return tournamentManagerService.apply(
        actor,
        view.tournament.id,
        action,
        view.tournament,
      );
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKey, updated);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setNotice("Player changes saved to the tournament.");
      if (
        variables.action.kind === "addPlayer" &&
        variables.options?.placeNewPlayer
      ) {
        const added = [...updated.players].sort((a, b) =>
          a.registrationNumber > b.registrationNumber ? -1 : 1,
        )[0];
        if (added) setModal({ kind: "move", player: added });
      } else if (variables.options?.close !== false) setModal(null);
    },
  });
  function openModal(next: OrganizerModal) {
    if (!isAdmin && next.kind !== "match") return;
    mutation.reset();
    setModal(next);
  }
  function applyAction(action: OrganizerAction, options?: ActionOptions) {
    if (!isAdmin || mutation.isPending) return;
    setNotice(null);
    mutation.mutate({ action, options });
  }
  const loading =
    tournamentsQuery.isLoading || (isFetching && !tournamentsQuery.data);
  const error = mutation.isError
    ? mutation.error instanceof Error
      ? mutation.error.message
      : "Couldn't save this change. Try again."
    : null;
  return (
    <div data-ocid="players_page" className="club-page">
      <header className="mb-8">
        <p className="section-kicker mb-4">{t("CHILLPONG / THE LINEUP")}</p>
        <h1 className="page-title">
          {t("THE")} <span className="text-primary">{t("PLAYERS.")}</span>
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-base-content/60">
          {t(
            "Find your next opponent. Follow the lineup by skill, status, table and round.",
          )}
        </p>
      </header>
      {loading ? (
        <div className="club-state" aria-busy="true" aria-live="polite">
          {t("Loading players…")}
        </div>
      ) : tournamentsQuery.isError ? (
        <div className="club-state" role="alert">
          <AlertTriangle
            className="mb-4 size-7 text-secondary"
            aria-hidden="true"
          />
          <h2 className="font-display text-2xl font-bold uppercase">
            {t("The lineup is offline.")}
          </h2>
          <p className="mt-3 text-sm text-base-content/50">
            {t("We couldn't load the tournament board.")}
          </p>
          <Button
            className="mt-6"
            onClick={() => void tournamentsQuery.refetch()}
          >
            {t("Try again")}
          </Button>
        </div>
      ) : !tournaments.length ? (
        <div className="club-state">
          <Users className="mb-4 size-8 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold uppercase">
            {t("The lineup starts with a tournament.")}
          </h2>
          <p className="mt-3 text-sm text-base-content/50">
            {t("Players appear here when they register for a tournament.")}
          </p>
          <a href="/tournaments" className="btn btn-outline mt-6">
            {t("Tournament board")}
          </a>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4 border-y border-base-300 py-5">
            <label className="w-full sm:max-w-xs">
              <span className="technical-label mb-2 block text-base-content/50">
                {t("Tournament")}
              </span>
              <select
                className="select w-full rounded-none"
                value={selected}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setModal(null);
                  setNotice(null);
                  mutation.reset();
                }}
              >
                {tournaments.map((item) => (
                  <option key={item.id.toString()} value={item.id.toString()}>
                    {item.title} / {t(item.status)}
                  </option>
                ))}
              </select>
            </label>
            {tournament ? (
              <a
                href={`/tournaments/${tournament.id}`}
                className="btn btn-outline btn-sm"
              >
                {t("Open tournament room")}{" "}
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
          {tournament ? (
            <p className="mt-4 text-xs text-base-content/45">
              {tournament.venue}{" "}
              {t("· Registration order belongs to this tournament.")}
            </p>
          ) : null}
          {notice ? (
            <output className="mt-6 flex items-center gap-2 border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
              <Check className="size-4 text-primary" aria-hidden="true" />
              {t(notice)}
            </output>
          ) : null}
          {stateQuery.isLoading || !tournament ? (
            <div
              className="club-state mt-8"
              aria-busy="true"
              aria-live="polite"
            >
              {t("Loading the selected lineup…")}
            </div>
          ) : stateQuery.isError ? (
            <div className="club-state mt-8" role="alert">
              <h2 className="font-display text-2xl font-bold uppercase">
                {t("Players unavailable.")}
              </h2>
              <p className="mt-3 text-sm text-base-content/50">
                {t("We couldn't load this tournament's players.")}
              </p>
              <Button
                className="mt-6"
                onClick={() => void stateQuery.refetch()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("Try again")}
              </Button>
            </div>
          ) : !view ? (
            <div className="club-state mt-8">
              <p>{t("This tournament is no longer available.")}</p>
              <Button
                className="mt-4"
                onClick={() => void tournamentsQuery.refetch()}
              >
                {t("Refresh tournaments")}
              </Button>
            </div>
          ) : (
            <>
              <PlayersPanel
                standalone
                key={selected}
                view={view}
                isAdmin={isAdmin}
                pending={mutation.isPending}
                onAdd={() => openModal({ kind: "player" })}
                onEdit={(player) => openModal({ kind: "player", player })}
                onRemove={(player) => openModal({ kind: "remove", player })}
                onPrioritize={(player) =>
                  applyAction({ kind: "prioritizePlayer", playerId: player.id })
                }
                onMove={(player) => openModal({ kind: "move", player })}
              />
              <OrganizerDialogs
                view={view}
                modal={modal}
                isAdmin={isAdmin}
                pending={mutation.isPending}
                error={error}
                onClose={() => {
                  if (!mutation.isPending) setModal(null);
                }}
                onOpen={openModal}
                onAction={applyAction}
              />
            </>
          )}
          {error && !modal ? (
            <p
              role="alert"
              className="mt-5 border border-error/40 p-4 text-sm text-error"
            >
              {translateError(error)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
