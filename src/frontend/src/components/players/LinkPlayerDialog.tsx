import {
  type GlobalPlayerView as GlobalPlayer,
  type UserRoleView,
  createActor,
} from "@/backend";
import { Button } from "@/components/ui/Button";
import { translateError, useI18n } from "@/i18n";
import { PLAYERS_QUERY_KEY, playerService } from "@/services/players";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LinkPlayerDialog({
  user,
  isAdmin,
  onClose,
  onLinked,
}: {
  user: UserRoleView | null;
  isAdmin: boolean;
  onClose: () => void;
  onLinked: (player: GlobalPlayer, unlinked: boolean) => void;
}) {
  const { t } = useI18n();
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const open = !!user && isAdmin;
  const directory = useQuery({
    queryKey: PLAYERS_QUERY_KEY,
    queryFn: () => {
      if (!actor) throw new Error("The player directory is still connecting.");
      return playerService.list(actor);
    },
    enabled: open && !!actor && !isFetching,
  });
  const current = directory.data?.find(
    (player) => player.userId?.toString() === user?.id.toString(),
  );
  const selected = directory.data?.find(
    (player) => player.id.toString() === selectedId,
  );
  const available =
    !selected?.userId || selected.userId.toString() === user?.id.toString();
  const mutation = useMutation({
    mutationFn: async ({
      playerId,
      unlink,
    }: { playerId: bigint; unlink: boolean }) => {
      if (!actor || !isAdmin || !user)
        throw new Error("Admin access is required.");
      return unlink
        ? playerService.unlink(actor, playerId)
        : playerService.link(actor, playerId, user.id);
    },
    onSuccess: (player, variables) => {
      queryClient.setQueryData<GlobalPlayer[]>(PLAYERS_QUERY_KEY, (previous) =>
        (previous ?? []).map((entry) =>
          entry.id === player.id ? player : entry,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: PLAYERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["tournamentState"] });
      onLinked(player, variables.unlink);
      onClose();
    },
  });
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  function close() {
    if (!mutation.isPending) onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="modal club-modal"
      aria-labelledby="link-player-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {open && user ? (
        <div className="modal-box flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-xl flex-col overflow-hidden rounded-none border border-base-300 bg-base-200 p-4 sm:p-8">
          <header className="mb-5 flex shrink-0 items-start justify-between gap-4">
            <h2
              id="link-player-title"
              className="font-display text-3xl font-bold uppercase"
            >
              {t("Link player to member")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              disabled={mutation.isPending}
              aria-label={t("Close")}
              onClick={close}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </header>
          <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain">
            <p className="break-all font-mono text-xs text-base-content/50">
              {user.id.toString()}
            </p>
            {current ? (
              <div className="space-y-3 border border-primary/30 p-4">
                <p>{t("Linked player: {v1}", { v1: current.name })}</p>
                <p className="text-xs text-base-content/50">
                  {t(
                    "Unlink this player before selecting another. The account keeps its current name.",
                  )}
                </p>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={mutation.isPending}
                  loading={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ playerId: current.id, unlink: true })
                  }
                >
                  {t("Unlink player")}
                </Button>
              </div>
            ) : null}
            {directory.isLoading ? (
              <output>{t("Loading players…")}</output>
            ) : directory.isError ? (
              <div role="alert">
                <p>{t("Couldn't load the player directory.")}</p>
                <Button
                  className="mt-4"
                  onClick={() => void directory.refetch()}
                >
                  {t("Try again")}
                </Button>
              </div>
            ) : !current ? (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (selected && available && !mutation.isPending)
                    mutation.mutate({ playerId: selected.id, unlink: false });
                }}
              >
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Search shared players")}
                  </span>
                  <input
                    type="search"
                    className="input w-full rounded-none"
                    value={search}
                    disabled={mutation.isPending}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Player to link")}
                  </span>
                  <select
                    className="select w-full rounded-none"
                    value={selectedId}
                    disabled={mutation.isPending}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    <option value="">{t("Choose a player")}</option>
                    {(directory.data ?? [])
                      .filter(
                        (player) =>
                          player.name
                            .toLocaleLowerCase()
                            .includes(search.trim().toLocaleLowerCase()) ||
                          player.id.toString() === selectedId,
                      )
                      .map((player) => (
                        <option
                          key={player.id.toString()}
                          value={player.id.toString()}
                          disabled={
                            !!player.userId &&
                            player.userId.toString() !== user.id.toString()
                          }
                        >
                          {player.name} / L{player.skillLevel.toString()}
                          {player.userId ? ` / ${t("Already linked")}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="text-xs leading-relaxed text-secondary">
                  {t(
                    "Linking replaces this member's name with the player's name, even if they already set a name. Each member and player can have one link.",
                  )}
                </p>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  loading={mutation.isPending}
                  disabled={!selected || !available}
                >
                  {t("Link player")}
                </Button>
              </form>
            ) : null}
            {mutation.isError ? (
              <p role="alert" className="text-sm text-error">
                {translateError(
                  mutation.error instanceof Error
                    ? mutation.error.message
                    : "Couldn't save this change. Try again.",
                )}
              </p>
            ) : null}
          </div>
          <footer className="mt-5 shrink-0 border-t border-base-300 pt-4">
            <Button
              variant="ghost"
              disabled={mutation.isPending}
              onClick={close}
            >
              {t("Cancel")}
            </Button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
