import type { Backend, GlobalPlayerView } from "@/backend";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { Button } from "@/components/ui/Button";
import { translateError, useI18n } from "@/i18n";
import { PLAYERS_QUERY_KEY, playerService } from "@/services/players";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

export function DeletePlayerDialog({
  player,
  actor,
  isAdmin,
  onClose,
  onDeleted,
}: {
  player: GlobalPlayerView;
  actor: Backend | null;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const deletion = useMutation({
    mutationFn: async () => {
      if (!actor || !isAdmin) throw new Error("Admin access is required.");
      await playerService.remove(actor, player.id);
    },
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: PLAYERS_QUERY_KEY });
      client.setQueryData<GlobalPlayerView[]>(PLAYERS_QUERY_KEY, (previous) =>
        previous?.filter((entry) => entry.id !== player.id),
      );
      void client.invalidateQueries({ queryKey: PLAYERS_QUERY_KEY });
      void client.invalidateQueries({ queryKey: ["tournamentState"] });
      onDeleted();
    },
  });
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    cancelButton.current?.focus();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  function close() {
    if (!deletion.isPending) onClose();
  }
  return (
    <dialog
      ref={dialog}
      data-ocid="players.delete_dialog"
      className="modal club-modal"
      aria-labelledby="player-delete-title"
      aria-describedby="player-delete-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-box max-w-lg rounded-none border border-error/40 bg-base-200 p-6 sm:p-8">
        <header className="mb-5 flex items-center gap-3 text-error">
          <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
          <h2
            id="player-delete-title"
            className="font-display text-2xl font-bold uppercase"
          >
            {t("Delete player?")}
          </h2>
        </header>
        <p className="mb-4 break-words font-display text-xl font-bold">
          <PlayerIdentity player={player} size="sm" />
        </p>
        <p
          id="player-delete-description"
          className="text-sm leading-relaxed text-base-content/70"
        >
          {t(
            "This permanently removes the player from the shared directory and releases their member link. This cannot be undone.",
          )}
        </p>
        <p className="mt-3 text-sm text-base-content/50">
          {t(
            "Member accounts and saved tournament registrations, matches, and results will be kept.",
          )}
        </p>
        {deletion.isError ? (
          <p
            role="alert"
            className="mt-5 border border-error/40 p-3 text-sm text-error"
          >
            {deletion.error instanceof Error
              ? translateError(deletion.error.message)
              : t("Couldn't delete this player. Try again.")}
          </p>
        ) : null}
        <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t border-base-300 pt-5">
          <Button
            ref={cancelButton}
            variant="ghost"
            disabled={deletion.isPending}
            onClick={close}
          >
            {t("Cancel")}
          </Button>
          <Button
            variant="danger"
            loading={deletion.isPending}
            data-ocid="players.confirm_delete_button"
            onClick={() => deletion.mutate()}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("Delete permanently")}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
