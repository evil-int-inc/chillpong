import { Button } from "@/components/ui/Button";
import { translateError, translateHistory, useI18n } from "@/i18n";
import { countLabel } from "@/i18n/plurals";
import type { OrganizerAction } from "@/services/tournament-manager";
import {
  SKILL_LEVELS,
  type TournamentManagerView,
  type TournamentMatchView,
  type TournamentPlayerView,
  matchLabel,
  playerById,
  playerMovement,
  registrationLabel,
  sourceLabel,
} from "@/types/tournament-manager";
import { AlertTriangle, Flag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type OrganizerModal =
  | { kind: "player"; player?: TournamentPlayerView }
  | { kind: "remove"; player: TournamentPlayerView }
  | { kind: "move"; player: TournamentPlayerView }
  | { kind: "match"; matchId: bigint }
  | { kind: "reset"; matchId: bigint }
  | { kind: "generate" }
  | { kind: "undo" };

export interface ActionOptions {
  close?: boolean;
  placeNewPlayer?: boolean;
}

interface DialogProps {
  view: TournamentManagerView;
  modal: OrganizerModal | null;
  isAdmin: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onOpen: (modal: OrganizerModal) => void;
  onAction: (action: OrganizerAction, options?: ActionOptions) => void;
}

function PlayerForm({
  view,
  player,
  pending,
  onAction,
}: {
  view: TournamentManagerView;
  player?: TournamentPlayerView;
  pending: boolean;
  onAction: DialogProps["onAction"];
}) {
  const { t } = useI18n();
  const [name, setName] = useState(player?.name ?? "");
  const [skill, setSkill] = useState(player?.skill ?? 1);
  const valid = name.trim().length > 0 && name.trim().length <= 80;
  function save(placeNewPlayer = false) {
    if (!valid) return;
    onAction(
      player
        ? { kind: "editPlayer", playerId: player.id, name: name.trim(), skill }
        : { kind: "addPlayer", name: name.trim(), skill },
      { placeNewPlayer },
    );
  }
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="block">
        <span className="technical-label mb-2 block">{t("Player name")}</span>
        <input
          data-ocid="tournament.player_name_input"
          className="input w-full rounded-none"
          required
          maxLength={80}
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("Name on the table")}
        />
      </label>
      <label className="block">
        <span className="technical-label mb-2 block">{t("Skill level")}</span>
        <select
          data-ocid="tournament.player_skill_select"
          className="select w-full rounded-none"
          value={skill}
          disabled={pending}
          onChange={(event) => setSkill(Number(event.target.value))}
        >
          {SKILL_LEVELS.map((level, index) => (
            <option key={level} value={index + 1}>
              L{index + 1} — {t(level)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-base-content/45">
        {player
          ? t(
              "{v1} and the original registration time remain unchanged. Skill changes apply to future matchmaking.",
              { v1: registrationLabel(player.registrationNumber) },
            )
          : t(
              "A new permanent registration number and timestamp are saved automatically. The player joins after earlier registrations.",
            )}
      </p>
      <div className="flex flex-wrap justify-end gap-3 border-t border-base-300 pt-5">
        {!player && view.generated ? (
          <Button
            variant="outline"
            disabled={!valid || pending}
            onClick={() => save(true)}
          >
            {t("Register & place manually")}
          </Button>
        ) : null}
        <Button
          type="submit"
          data-ocid="tournament.save_player_button"
          loading={pending}
          disabled={!valid}
        >
          {player ? t("Save player") : t("Add to waiting queue")}
        </Button>
      </div>
    </form>
  );
}

function MovePlayerForm({
  view,
  player,
  pending,
  onAction,
}: {
  view: TournamentManagerView;
  player: TournamentPlayerView;
  pending: boolean;
  onAction: DialogProps["onAction"];
}) {
  const { t } = useI18n();
  const { entrant, targets: options } = playerMovement(view, player);
  const [target, setTarget] = useState(options[0]?.id.toString() ?? "");
  const [slot, setSlot] = useState<"a" | "b">("a");
  const validTarget = options.some((match) => match.id.toString() === target);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (validTarget)
          onAction({
            kind: entrant ? "placePlayer" : "movePlayer",
            playerId: player.id,
            matchId: BigInt(target),
            slot,
          });
      }}
    >
      <p className="text-sm leading-relaxed text-base-content/60">
        {t("Place")}{" "}
        <strong className="text-base-content">{player.name}</strong> {t("in")}{" "}
        {entrant
          ? t("a pending winners-bracket slot")
          : t("their current unplayed bracket round")}
        {t(". The registration remains")}{" "}
        {registrationLabel(player.registrationNumber)}.{" "}
        {entrant
          ? t(
              "An empty slot admits them directly. An occupied eligible slot creates a qualifier against its current player or incoming winner, keeping both players in the tournament. Opening qualifiers are round zero.",
            )
          : t(
              "An occupied pending slot swaps both incoming bracket positions; an empty slot moves this player. Completed results and original registration details remain unchanged.",
            )}
      </p>
      <label className="block">
        <span className="technical-label mb-2 block">
          {t("Destination match")}
        </span>
        <select
          aria-label={t("Destination match")}
          className="select w-full rounded-none"
          value={target}
          disabled={pending}
          onChange={(event) => setTarget(event.target.value)}
        >
          {options.length ? (
            options.map((match) => (
              <option key={match.id.toString()} value={match.id.toString()}>
                {matchLabel(match)} /{" "}
                {playerById(view.players, match.playerAId)?.name ??
                  sourceLabel(match.sourceA, view.matches)}{" "}
                {t("vs")}{" "}
                {playerById(view.players, match.playerBId)?.name ??
                  sourceLabel(match.sourceB, view.matches)}
              </option>
            ))
          ) : (
            <option value="">{t("No safe opening slots")}</option>
          )}
        </select>
      </label>
      <label className="block">
        <span className="technical-label mb-2 block">
          {t("Destination slot")}
        </span>
        <select
          className="select w-full rounded-none"
          value={slot}
          disabled={pending}
          onChange={(event) => setSlot(event.target.value as "a" | "b")}
        >
          <option value="a">{t("Player A")}</option>
          <option value="b">{t("Player B")}</option>
        </select>
      </label>
      <p className="text-xs leading-relaxed text-secondary/80">
        {t(
          "Manual override. The backend rejects changes that would overwrite a played match or an active downstream match.",
        )}
      </p>
      <div className="flex justify-end border-t border-base-300 pt-5">
        <Button type="submit" loading={pending} disabled={!validTarget}>
          {t("Place player")}
        </Button>
      </div>
    </form>
  );
}

function MatchEditor({
  view,
  match,
  isAdmin,
  pending,
  onAction,
  onOpen,
}: {
  view: TournamentManagerView;
  match: TournamentMatchView;
  isAdmin: boolean;
  pending: boolean;
  onAction: DialogProps["onAction"];
  onOpen: DialogProps["onOpen"];
}) {
  const { t } = useI18n();
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [table, setTable] = useState(match.table?.toString() ?? "");
  const [playerA, setPlayerA] = useState(match.playerAId?.toString() ?? "");
  const [playerB, setPlayerB] = useState(match.playerBId?.toString() ?? "");
  const [byeSlot, setByeSlot] = useState<"a" | "b">("b");
  const [firstSlot, setFirstSlot] = useState<"a" | "b">("a");
  const [otherMatch, setOtherMatch] = useState("");
  const [otherSlot, setOtherSlot] = useState<"a" | "b">("b");
  const [validation, setValidation] = useState<string | null>(null);
  const editableOpening =
    match.bracket === "winners" &&
    match.round === 1 &&
    match.status !== "playing" &&
    match.status !== "completed";
  const activePlayers = view.players.filter(
    (player) => player.status !== "removed" && player.status !== "eliminated",
  );
  const canSwapBracket =
    match.bracket === "winners" || match.bracket === "losers";
  const swapMatches = view.matches.filter(
    (item) =>
      canSwapBracket &&
      item.id !== match.id &&
      item.bracket === match.bracket &&
      item.round === match.round &&
      (item.status === "ready" || (editableOpening && item.status === "bye")),
  );
  useEffect(() => {
    setScoreA(match.scoreA?.toString() ?? "");
    setScoreB(match.scoreB?.toString() ?? "");
  }, [match.scoreA, match.scoreB]);
  useEffect(() => {
    setTable(match.table?.toString() ?? "");
  }, [match.table]);
  useEffect(() => {
    setPlayerA(match.playerAId?.toString() ?? "");
    setPlayerB(match.playerBId?.toString() ?? "");
  }, [match.playerAId, match.playerBId]);
  const currentPlayers = [
    {
      id: match.playerAId,
      source: match.sourceA,
      score: match.scoreA,
      slot: "a",
    },
    {
      id: match.playerBId,
      source: match.sourceB,
      score: match.scoreB,
      slot: "b",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="divide-y divide-base-300 border-y border-base-300">
        {currentPlayers.map((side) => {
          const player = playerById(view.players, side.id);
          return (
            <div
              key={side.slot}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p
                  className={`font-display text-2xl font-bold ${side.id !== undefined && side.id === match.winnerId ? "text-primary" : ""}`}
                >
                  {player?.name ?? sourceLabel(side.source, view.matches)}
                </p>
                {player ? (
                  <p className="mt-1 font-mono text-[10px] text-base-content/45">
                    L{player.skill} / {t(SKILL_LEVELS[player.skill - 1])} /{" "}
                    {registrationLabel(player.registrationNumber)}
                  </p>
                ) : null}
              </div>
              <span className="font-mono text-3xl">{side.score ?? "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-5 font-mono text-[10px] uppercase tracking-wider text-base-content/45">
        <span>
          {t("Status /")} {t(match.status)}
        </span>
        <span>
          {match.table
            ? t("Table {v1}", { v1: match.table })
            : t("No table assigned")}
        </span>
        {match.manualOverride || match.prioritized ? (
          <span className="flex items-center gap-1 text-secondary">
            <Flag className="size-3" aria-hidden="true" />{" "}
            {t("Manual override")}
          </span>
        ) : null}
      </div>
      {isAdmin ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label>
              <span className="technical-label mb-2 block text-[10px]">
                {t("Assign table")}
              </span>
              <select
                aria-label={t("Assign table")}
                className="select w-full rounded-none"
                value={table}
                disabled={
                  pending ||
                  match.status === "completed" ||
                  match.status === "bye" ||
                  match.status === "void"
                }
                onChange={(event) => setTable(event.target.value)}
              >
                <option value="">{t("Unassigned")}</option>
                {view.tables.map((item) => (
                  <option
                    key={item.number}
                    value={item.number}
                    disabled={
                      item.matchId !== undefined &&
                      item.matchId !== match.id &&
                      (item.status === "playing" || item.status === "waiting")
                    }
                  >
                    {t("Table")} {item.number} / {t(item.status)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              className="sm:self-end"
              disabled={
                pending ||
                match.status === "completed" ||
                match.status === "bye" ||
                match.status === "void"
              }
              onClick={() =>
                onAction(
                  {
                    kind: "assignTable",
                    matchId: match.id,
                    table: table ? Number(table) : undefined,
                  },
                  { close: false },
                )
              }
            >
              {t("Assign table")}
            </Button>
            <Button
              className="sm:self-end"
              disabled={
                pending ||
                match.status !== "ready" ||
                match.playerAId === undefined ||
                match.playerBId === undefined ||
                match.table === undefined
              }
              onClick={() =>
                onAction(
                  { kind: "startMatch", matchId: match.id },
                  { close: false },
                )
              }
            >
              {t("Start match")}
            </Button>
          </div>
          {match.status === "playing" || match.status === "completed" ? (
            <form
              className="space-y-4 border border-base-300 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                setValidation(null);
                const a = Number(scoreA);
                const b = Number(scoreB);
                if (
                  !scoreA ||
                  !scoreB ||
                  !Number.isSafeInteger(a) ||
                  !Number.isSafeInteger(b) ||
                  a < 0 ||
                  b < 0
                ) {
                  setValidation(
                    "Enter a non-negative whole-number score for both players.",
                  );
                  return;
                }
                if (a === b) {
                  setValidation(
                    "A knockout match needs a winner. Scores cannot be tied.",
                  );
                  return;
                }
                onAction({
                  kind: "recordResult",
                  matchId: match.id,
                  scoreA: a,
                  scoreB: b,
                });
              }}
            >
              <p className="technical-label text-primary">
                {match.status === "completed"
                  ? t("Correct the result")
                  : t("Save the result")}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="technical-label mb-2 block text-[10px]">
                    {t("Score A")}
                  </span>
                  <input
                    type="number"
                    className="input w-full rounded-none font-mono text-xl"
                    min={0}
                    step={1}
                    required
                    value={scoreA}
                    disabled={pending}
                    onChange={(event) => setScoreA(event.target.value)}
                  />
                </label>
                <label>
                  <span className="technical-label mb-2 block text-[10px]">
                    {t("Score B")}
                  </span>
                  <input
                    type="number"
                    className="input w-full rounded-none font-mono text-xl"
                    min={0}
                    step={1}
                    required
                    value={scoreB}
                    disabled={pending}
                    onChange={(event) => setScoreB(event.target.value)}
                  />
                </label>
              </div>
              {validation ? (
                <p role="alert" className="text-xs text-error">
                  {t(validation)}
                </p>
              ) : null}
              <p className="text-xs leading-relaxed text-base-content/45">
                {t(
                  "Winners advance and the table is freed automatically. Changing a winner after downstream games requires a confirmed reset.",
                )}
              </p>
              <Button
                type="submit"
                data-ocid="tournament.save_result_button"
                loading={pending}
              >
                {t("Save result")}
              </Button>
            </form>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || match.status !== "ready"}
              onClick={() =>
                onAction(
                  { kind: "prioritizeMatch", matchId: match.id },
                  { close: false },
                )
              }
            >
              {t("Prioritize match")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={
                pending ||
                (match.status !== "completed" &&
                  match.status !== "playing" &&
                  match.status !== "bye")
              }
              onClick={() => onOpen({ kind: "reset", matchId: match.id })}
            >
              {t("Reset match / undo result")}
            </Button>
          </div>
          {canSwapBracket ? (
            <details className="border-t border-base-300 pt-5">
              <summary className="technical-label cursor-pointer text-secondary">
                {t("Manual override / players & byes")}
              </summary>
              <div className="mt-5 space-y-5">
                <p className="text-xs leading-relaxed text-base-content/45">
                  {t(
                    "Opening slots can be replaced. Later ready matches can swap opponents within the same bracket and round. Registration numbers never change.",
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: "Player A slot",
                      value: playerA,
                      setter: setPlayerA,
                    },
                    {
                      label: "Player B slot",
                      value: playerB,
                      setter: setPlayerB,
                    },
                  ].map((side) => (
                    <label key={side.label}>
                      <span className="technical-label mb-2 block text-[10px]">
                        {t(side.label)}
                      </span>
                      <select
                        className="select w-full rounded-none"
                        value={side.value}
                        disabled={pending || !editableOpening}
                        onChange={(event) => side.setter(event.target.value)}
                      >
                        <option value="">{t("BYE / empty slot")}</option>
                        {activePlayers.map((player) => (
                          <option
                            key={player.id.toString()}
                            value={player.id.toString()}
                          >
                            {registrationLabel(player.registrationNumber)}{" "}
                            {player.name} {t("/ L")}
                            {player.skill}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    pending ||
                    !editableOpening ||
                    (!!playerA && playerA === playerB)
                  }
                  onClick={() =>
                    onAction(
                      {
                        kind: "setMatchPlayers",
                        matchId: match.id,
                        playerA: playerA ? BigInt(playerA) : undefined,
                        playerB: playerB ? BigInt(playerB) : undefined,
                      },
                      { close: false },
                    )
                  }
                >
                  {t("Change matchup")}
                </Button>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label>
                    <span className="technical-label mb-2 block text-[10px]">
                      {t("Assign BYE to slot")}
                    </span>
                    <select
                      className="select w-full rounded-none"
                      value={byeSlot}
                      disabled={pending || !editableOpening}
                      onChange={(event) =>
                        setByeSlot(event.target.value as "a" | "b")
                      }
                    >
                      <option value="a">{t("Player A")}</option>
                      <option value="b">{t("Player B")}</option>
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="sm:self-end"
                    disabled={pending || !editableOpening}
                    onClick={() =>
                      onAction(
                        { kind: "assignBye", matchId: match.id, slot: byeSlot },
                        { close: false },
                      )
                    }
                  >
                    {t("Assign BYE")}
                  </Button>
                </div>
                <div className="space-y-3 border-t border-base-300 pt-4">
                  <p className="technical-label text-[10px]">
                    {t("Swap players between ready matches")}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="technical-label mb-2 block text-[9px]">
                        {t("This match slot")}
                      </span>
                      <select
                        className="select w-full rounded-none"
                        value={firstSlot}
                        disabled={pending}
                        onChange={(event) =>
                          setFirstSlot(event.target.value as "a" | "b")
                        }
                      >
                        <option value="a">{t("Player A")}</option>
                        <option value="b">{t("Player B")}</option>
                      </select>
                    </label>
                    <label>
                      <span className="technical-label mb-2 block text-[9px]">
                        {t("Other match")}
                      </span>
                      <select
                        className="select w-full rounded-none"
                        value={otherMatch}
                        disabled={pending}
                        onChange={(event) => setOtherMatch(event.target.value)}
                      >
                        <option value="">{t("Choose match")}</option>
                        {swapMatches.map((item) => (
                          <option
                            key={item.id.toString()}
                            value={item.id.toString()}
                          >
                            {matchLabel(item)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="technical-label mb-2 block text-[9px]">
                        {t("Other match slot")}
                      </span>
                      <select
                        className="select w-full rounded-none"
                        value={otherSlot}
                        disabled={pending}
                        onChange={(event) =>
                          setOtherSlot(event.target.value as "a" | "b")
                        }
                      >
                        <option value="a">{t("Player A")}</option>
                        <option value="b">{t("Player B")}</option>
                      </select>
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      pending ||
                      !otherMatch ||
                      (match.status !== "ready" && !editableOpening)
                    }
                    onClick={() =>
                      onAction(
                        {
                          kind: "swapPlayers",
                          firstMatchId: match.id,
                          firstSlot,
                          secondMatchId: BigInt(otherMatch),
                          secondSlot: otherSlot,
                        },
                        { close: false },
                      )
                    }
                  >
                    {t("Swap players")}
                  </Button>
                </div>
              </div>
            </details>
          ) : (
            <p className="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/45">
              {t(
                "Finalist positions stay fixed because they determine whether a double elimination reset final is required.",
              )}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-base-content/45">
          {t(
            "Results and assignments are managed by the tournament organizer.",
          )}
        </p>
      )}
    </div>
  );
}

function ResetForm({
  match,
  pending,
  onAction,
}: {
  match: TournamentMatchView;
  pending: boolean;
  onAction: DialogProps["onAction"];
}) {
  const { t } = useI18n();
  const [cascade, setCascade] = useState(false);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-base-content/65">
        {t("Resetting")}{" "}
        <strong className="text-base-content">{matchLabel(match)}</strong>{" "}
        {t(
          "clears its score, winner and table assignment. Earlier registration details remain unchanged.",
        )}
      </p>
      <label className="flex items-start gap-3 border border-secondary/30 p-4">
        <input
          type="checkbox"
          className="checkbox checkbox-sm mt-0.5 rounded-none"
          checked={cascade}
          disabled={pending}
          onChange={(event) => setCascade(event.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold">
            {t("Also reset completed downstream results")}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-base-content/45">
            {t(
              "This can erase scores in later rounds. Active downstream matches must be resolved first; the backend prevents resetting across a playing match.",
            )}
          </span>
        </span>
      </label>
      <p className="text-xs text-secondary/80">
        {t(
          "If later rounds depend on this result, a plain reset is rejected until downstream results are explicitly included.",
        )}
      </p>
      <Button
        variant="danger"
        data-ocid="tournament.confirm_reset_button"
        loading={pending}
        onClick={() =>
          onAction({ kind: "resetMatch", matchId: match.id, cascade })
        }
      >
        {t("Confirm reset")}
      </Button>
    </div>
  );
}

export function OrganizerDialogs({
  view,
  modal,
  isAdmin,
  pending,
  error,
  onClose,
  onOpen,
  onAction,
}: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const allowed = !!modal && (isAdmin || modal.kind === "match");
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (allowed && modal) {
      if (!dialog.open) dialog.showModal();
      dialog
        .querySelector<HTMLElement>(
          "input:not([disabled]), select:not([disabled])",
        )
        ?.focus();
    } else if (dialog.open) dialog.close();
  }, [allowed, modal]);
  const match =
    modal && (modal.kind === "match" || modal.kind === "reset")
      ? view.matches.find((item) => item.id === modal.matchId)
      : undefined;
  const lastAction = [...view.history].sort((a, b) =>
    a.id > b.id ? -1 : 1,
  )[0];
  const playerCount = view.players.filter(
    (player) => player.status !== "removed",
  ).length;
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, playerCount)));
  const title = !modal
    ? "Tournament controls"
    : modal.kind === "player"
      ? modal.player
        ? "Edit player."
        : "Add to the lineup."
      : modal.kind === "remove"
        ? "Remove player?"
        : modal.kind === "move"
          ? "Move / place player."
          : modal.kind === "generate"
            ? "Generate the draw."
            : modal.kind === "undo"
              ? "Undo last action?"
              : modal.kind === "reset"
                ? "Reset this result?"
                : t("Match {match}", {
                    match: match ? matchLabel(match) : t("unavailable"),
                  });
  return (
    <dialog
      ref={ref}
      data-ocid="tournament.organizer_dialog"
      className="modal club-modal"
      aria-labelledby="organizer-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!pending) onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      {allowed && modal ? (
        <div className="modal-box max-w-2xl rounded-none border border-base-300 bg-base-200 p-6 sm:p-8">
          <header className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker mb-2">
                {t("CHILLPONG /")}{" "}
                {modal.kind === "match" ? t("MATCH FILE") : t("ORGANIZER DESK")}
              </p>
              <h2
                id="organizer-dialog-title"
                className="font-display text-3xl font-bold uppercase tracking-tight"
              >
                {t(title)}
              </h2>
            </div>
            <button
              type="button"
              aria-label={t("Close tournament controls")}
              className="btn btn-ghost btn-square btn-sm"
              disabled={pending}
              onClick={onClose}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          {modal.kind === "player" ? (
            <PlayerForm
              key={modal.player?.id.toString() ?? "new"}
              view={view}
              player={modal.player}
              pending={pending}
              onAction={onAction}
            />
          ) : null}
          {modal.kind === "move" ? (
            <MovePlayerForm
              key={modal.player.id.toString()}
              view={view}
              player={modal.player}
              pending={pending}
              onAction={onAction}
            />
          ) : null}
          {modal.kind === "match" && match ? (
            <MatchEditor
              key={match.id.toString()}
              view={view}
              match={match}
              isAdmin={isAdmin}
              pending={pending}
              onAction={onAction}
              onOpen={onOpen}
            />
          ) : null}
          {modal.kind === "reset" && match ? (
            <ResetForm
              key={match.id.toString()}
              match={match}
              pending={pending}
              onAction={onAction}
            />
          ) : null}
          {modal.kind === "remove" ? (
            <div className="space-y-5">
              <p className="font-display text-xl font-bold">
                {modal.player.name}{" "}
                <span className="font-mono text-xs font-normal text-primary">
                  {registrationLabel(modal.player.registrationNumber)}
                </span>
              </p>
              <div className="flex gap-3 border border-secondary/30 bg-secondary/5 p-4">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-base-content/65">
                  {modal.player.status === "playing"
                    ? t(
                        "This player is currently playing. Their opponent may advance by forfeit when they are removed.",
                      )
                    : t(
                        "The player leaves the waiting queue and unplayed bracket slots.",
                      )}
                  {t(
                    "Completed results remain in history. Pending dependencies are updated where safe; active downstream matches can block removal.",
                  )}
                </p>
              </div>
              <p className="text-xs text-base-content/45">
                {t(
                  "Their permanent registration number is retained and will not be reused.",
                )}
              </p>
              <Button
                variant="danger"
                data-ocid="tournament.confirm_remove_button"
                loading={pending}
                onClick={() =>
                  onAction({ kind: "removePlayer", playerId: modal.player.id })
                }
              >
                {t("Remove player")}
              </Button>
            </div>
          ) : null}
          {modal.kind === "generate" ? (
            <div className="space-y-5">
              <p className="font-display text-2xl font-bold">
                {countLabel(playerCount, "player")} /{" "}
                {countLabel(bracketSize, "slot")}
              </p>
              <p className="font-mono text-xs text-primary">
                {bracketSize - playerCount} {t("BYEs /")}{" "}
                {view.elimination === "double"
                  ? t("Double elimination")
                  : t("Single elimination")}
              </p>
              <p className="text-sm leading-relaxed text-base-content/60">
                {t(
                  "The draw pairs compatible skill levels first, then uses permanent registration order to settle equal choices. Winners advance automatically;",
                )}{" "}
                {view.elimination === "double"
                  ? t("players leave after their second loss.")
                  : t("one loss eliminates a player.")}
              </p>
              {view.generated ? (
                <p className="border border-secondary/30 p-3 text-xs text-secondary/90">
                  {t(
                    "This regenerates the unplayed bracket and replaces manual opening assignments. Registered players stay intact.",
                  )}
                </p>
              ) : null}
              <Button
                data-ocid="tournament.confirm_generate_button"
                loading={pending}
                disabled={playerCount < 2 || !view.canChangeFormat}
                onClick={() => onAction({ kind: "generateBracket" })}
              >
                {t("Generate bracket")}
              </Button>
            </div>
          ) : null}
          {modal.kind === "undo" ? (
            <div className="space-y-5">
              <p className="text-sm text-base-content/60">
                {t(
                  "Restore the tournament state immediately before the most recent organizer action.",
                )}
              </p>
              <p className="border border-base-300 p-4 font-mono text-xs">
                {lastAction
                  ? translateHistory(lastAction.label)
                  : t("Most recent action")}
              </p>
              <p className="text-xs leading-relaxed text-base-content/45">
                {t(
                  "Player registration counters continue forward so registration numbers remain permanent. Restored results, assignments and queue positions are saved automatically.",
                )}
              </p>
              <Button
                data-ocid="tournament.confirm_undo_button"
                loading={pending}
                disabled={!view.canUndo}
                onClick={() => onAction({ kind: "undo" })}
              >
                {t("Confirm undo")}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p
              data-ocid="tournament.action_error"
              role="alert"
              className="mt-5 border border-error/35 px-4 py-3 text-sm text-error"
            >
              {translateError(error)}
            </p>
          ) : null}
          <footer className="mt-6 flex justify-end border-t border-base-300 pt-4">
            <Button variant="ghost" disabled={pending} onClick={onClose}>
              {modal.kind === "match" ? t("Close") : t("Cancel")}
            </Button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
