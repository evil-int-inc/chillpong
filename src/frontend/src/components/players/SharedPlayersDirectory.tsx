import { type GlobalPlayerView as GlobalPlayer, createActor } from "@/backend";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { Button } from "@/components/ui/Button";
import { translateError, useI18n } from "@/i18n";
import { PLAYERS_QUERY_KEY, playerService } from "@/services/players";
import { SKILL_LEVELS, registrationLabel } from "@/types/tournament-manager";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function SharedPlayerForm({
  player,
  pending,
  onSave,
}: {
  player?: GlobalPlayer;
  pending: boolean;
  onSave: (name: string, skill: number) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(player?.name ?? "");
  const [skill, setSkill] = useState(Number(player?.skillLevel ?? 1n));
  const valid = name.trim().length > 0 && name.trim().length <= 80;
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !pending) onSave(name.trim(), skill);
      }}
    >
      <label className="block">
        <span className="technical-label mb-2 block">{t("Player name")}</span>
        <input
          required
          maxLength={80}
          className="input w-full rounded-none"
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block">
        <span className="technical-label mb-2 block">{t("Skill level")}</span>
        <select
          className="select w-full rounded-none"
          value={skill}
          disabled={pending}
          onChange={(event) => setSkill(Number(event.target.value))}
        >
          {SKILL_LEVELS.map((level, index) => (
            <option key={level} value={index + 1}>
              L{index + 1} / {t(level)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-base-content/50">
        {t(
          "Shared player details apply to future registrations. Existing tournament names, scores and registration order stay unchanged.",
        )}
      </p>
      {player?.userId ? (
        <p className="text-xs leading-relaxed text-secondary">
          {t("Saving this player also updates their linked account's name.")}
        </p>
      ) : null}
      <Button
        type="submit"
        loading={pending}
        disabled={!valid}
        className="w-full sm:w-auto"
      >
        {player ? t("Save player") : t("Create player")}
      </Button>
    </form>
  );
}

export function SharedPlayersDirectory({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("all");
  const [sort, setSort] = useState("registration");
  const [editing, setEditing] = useState<GlobalPlayer | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const directory = useQuery({
    queryKey: PLAYERS_QUERY_KEY,
    queryFn: () => {
      if (!actor) throw new Error("The player directory is still connecting.");
      return playerService.list(actor);
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const save = useMutation({
    mutationFn: async ({ name, skill }: { name: string; skill: number }) => {
      if (!actor || !isAdmin || !editing)
        throw new Error("Admin access is required.");
      return editing === "new"
        ? playerService.create(actor, name, skill)
        : playerService.update(actor, editing.id, name, skill);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<GlobalPlayer[]>(
        PLAYERS_QUERY_KEY,
        (previous) => [
          ...(previous ?? []).filter((player) => player.id !== saved.id),
          saved,
        ],
      );
      void queryClient.invalidateQueries({ queryKey: PLAYERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditing(null);
      setNotice("Shared player saved. Available for every tournament.");
    },
  });
  const open = editing !== null && isAdmin;
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const players = [...(directory.data ?? [])]
    .filter((player) => {
      const term = search.trim().toLocaleLowerCase();
      return (
        (player.name.toLocaleLowerCase().includes(term) ||
          registrationLabel(player.id).includes(term)) &&
        (skill === "all" || player.skillLevel.toString() === skill)
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "skill" && a.skillLevel !== b.skillLevel
          ? Number(a.skillLevel - b.skillLevel)
          : a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0,
    );
  function edit(player: GlobalPlayer | "new") {
    if (!isAdmin || save.isPending) return;
    save.reset();
    setNotice(null);
    setEditing(player);
  }
  return (
    <section className="mt-6" aria-labelledby="shared-players-title">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="shared-players-title"
            className="technical-label text-base-content/60"
          >
            {t("All players")} / {directory.data?.length ?? 0}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-base-content/50">
            {t(
              "One shared directory for every tournament. Choose a tournament above to see its registration order, status, tables and rounds.",
            )}
          </p>
        </div>
        {isAdmin ? (
          <Button onClick={() => edit("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("Create player")}
          </Button>
        ) : null}
      </header>
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="club-search flex items-center gap-3 border border-base-300 px-3">
          <Search
            className="size-4 shrink-0 text-base-content/40"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label={t("Search shared players")}
            placeholder={t("NAME / PLAYER NUMBER")}
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{t("Skill level")}</span>
          <select
            className="select w-full rounded-none"
            value={skill}
            onChange={(event) => setSkill(event.target.value)}
          >
            <option value="all">{t("All skill levels")}</option>
            {SKILL_LEVELS.map((level, index) => (
              <option key={level} value={index + 1}>
                L{index + 1} / {t(level)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("Sort by")}</span>
          <select
            className="select w-full rounded-none"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="registration">{t("Registration order")}</option>
            <option value="name">{t("Name / A–Z")}</option>
            <option value="skill">{t("Skill level / L1–L5")}</option>
          </select>
        </label>
      </div>
      {notice ? (
        <output className="mb-5 block border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          {t(notice)}
        </output>
      ) : null}
      {directory.isLoading || (isFetching && !directory.data) ? (
        <div className="club-state" aria-busy="true" aria-live="polite">
          {t("Loading players…")}
        </div>
      ) : directory.isError ? (
        <div className="club-state" role="alert">
          <p>{t("Couldn't load the player directory.")}</p>
          <Button className="mt-4" onClick={() => void directory.refetch()}>
            {t("Try again")}
          </Button>
        </div>
      ) : players.length ? (
        <ul className="divide-y divide-base-300 border border-base-300">
          {players.map((player) => (
            <li
              key={player.id.toString()}
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"
            >
              <div className="min-w-0">
                <p className="break-words font-display text-xl font-bold uppercase">
                  <PlayerIdentity
                    player={player}
                    size="sm"
                    nameClassName="break-words"
                  />
                </p>
                <p className="mt-1 font-mono text-xs text-base-content/45">
                  {registrationLabel(player.id)} / L
                  {player.skillLevel.toString()} /{" "}
                  {t(SKILL_LEVELS[Number(player.skillLevel) - 1])}
                </p>
                {player.userId ? (
                  <p className="mt-2 text-xs text-primary">
                    {t("Linked to a member")}
                  </p>
                ) : null}
              </div>
              {isAdmin ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("Edit shared player {v1}", { v1: player.name })}
                  onClick={() => edit(player)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("Edit")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="club-state">
          <p className="font-display text-xl font-bold uppercase">
            {directory.data?.length
              ? t("No matching players.")
              : t("The shared lineup is open.")}
          </p>
          <p className="mt-3 text-sm text-base-content/50">
            {directory.data?.length
              ? t("Try another name or adjust the skill filter.")
              : t(
                  "Create a player here or add one in a tournament. They will be available across the app.",
                )}
          </p>
        </div>
      )}
      <dialog
        ref={dialog}
        className="modal club-modal"
        aria-labelledby="shared-player-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!save.isPending) setEditing(null);
        }}
      >
        {open ? (
          <div className="modal-box flex max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-xl flex-col overflow-hidden rounded-none border border-base-300 bg-base-200 p-4 sm:p-8">
            <header className="mb-5 flex shrink-0 items-start justify-between gap-3">
              <h2
                id="shared-player-dialog-title"
                className="font-display text-3xl font-bold uppercase"
              >
                {editing === "new"
                  ? t("Create player")
                  : t("Edit shared player")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Close")}
                disabled={save.isPending}
                onClick={() => setEditing(null)}
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            </header>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <SharedPlayerForm
                key={editing === "new" ? "new" : editing?.id.toString()}
                player={editing === "new" ? undefined : (editing ?? undefined)}
                pending={save.isPending}
                onSave={(name, skill) => save.mutate({ name, skill })}
              />
              {save.isError ? (
                <p role="alert" className="mt-5 text-sm text-error">
                  {translateError(
                    save.error instanceof Error
                      ? save.error.message
                      : "Couldn't save this change. Try again.",
                  )}
                </p>
              ) : null}
            </div>
            <footer className="mt-5 shrink-0 border-t border-base-300 pt-4">
              <Button
                variant="ghost"
                disabled={save.isPending}
                onClick={() => setEditing(null)}
              >
                {t("Cancel")}
              </Button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
