import type { Backend, Tournament } from "@/backend";
import { Button } from "@/components/ui/Button";
import { translateError, useI18n } from "@/i18n";
import { tournamentService } from "@/services/tournaments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

export function DeleteTournamentDialog({
  tournament,
  actor,
  isAdmin,
  onClose,
  onDeleted,
}: {
  tournament: Tournament;
  actor: Backend | null;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: (tournament: Tournament) => void;
}) {
  const { t } = useI18n();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const deletion = useMutation({
    mutationFn: async () => {
      if (!actor || !isAdmin) throw new Error("Admin access is required.");
      await tournamentService.remove(actor, tournament.id);
    },
    onSuccess: async () => {
      const stateKey = ["tournamentState", tournament.id.toString()];
      await Promise.all([
        client.cancelQueries({ queryKey: ["tournaments"] }),
        client.cancelQueries({ queryKey: stateKey }),
      ]);
      client.setQueryData<Tournament[]>(["tournaments"], (previous) =>
        previous?.filter((entry) => entry.id !== tournament.id),
      );
      client.removeQueries({ queryKey: stateKey });
      void client.invalidateQueries({ queryKey: ["tournaments"] });
      onDeleted(tournament);
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
      data-ocid="tournaments.delete_dialog"
      className="modal club-modal"
      aria-labelledby="tournament-delete-title"
      aria-describedby="tournament-delete-description"
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
            id="tournament-delete-title"
            className="font-display text-2xl font-bold uppercase"
          >
            {t("Delete tournament?")}
          </h2>
        </header>
        <p className="mb-4 break-words font-display text-xl font-bold">
          {tournament.title}
        </p>
        <p
          id="tournament-delete-description"
          className="text-sm leading-relaxed text-base-content/70"
        >
          {t(
            "This permanently deletes the tournament, its registrations, matches, results, and history. This cannot be undone.",
          )}
        </p>
        <p className="mt-3 text-sm text-base-content/50">
          {t("Shared club players and member accounts will be kept.")}
        </p>
        {deletion.isError ? (
          <p
            role="alert"
            className="mt-5 border border-error/40 p-3 text-sm text-error"
          >
            {deletion.error instanceof Error
              ? translateError(deletion.error.message)
              : t("Couldn't delete this tournament. Try again.")}
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
            data-ocid="tournaments.confirm_delete_button"
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
