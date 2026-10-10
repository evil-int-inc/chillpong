import {
  type Tournament,
  TournamentFormat,
  type TournamentInput,
  TournamentStatus,
  createActor,
} from "@/backend";
import { CopyBracketLink } from "@/components/tournaments/CopyBracketLink";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import {
  type LocalizedMessage,
  getLocale,
  translateError,
  useI18n,
} from "@/i18n";
import { formatClubDate } from "@/i18n/date";
import { countLabel } from "@/i18n/plurals";
import { tournamentService } from "@/services/tournaments";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const TOURNAMENTS_QUERY_KEY = ["tournaments"] as const;
const TBILISI_TIME_ZONE = "Asia/Tbilisi";
const FILTERS = ["all", "upcoming", "live", "completed"] as const;
type StatusFilter = (typeof FILTERS)[number];

function eventDate(timestamp: bigint) {
  return new Date(Number(timestamp / 1_000_000n));
}

function datePart(timestamp: bigint, options: Intl.DateTimeFormatOptions) {
  return formatClubDate(eventDate(timestamp), {
    ...options,
    timeZone: TBILISI_TIME_ZONE,
  });
}

function eventTime(timestamp: bigint) {
  return eventDate(timestamp).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TBILISI_TIME_ZONE,
  });
}

/** A datetime-local field represents the venue's time, wherever the viewer is. */
function toVenueDateTime(timestamp: bigint) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TBILISI_TIME_ZONE,
  }).formatToParts(eventDate(timestamp));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function CourtGraphic() {
  const { t } = useI18n();
  return (
    <div
      className="tournament-art relative hidden min-h-72 overflow-hidden lg:flex lg:items-center lg:justify-center"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 460 300"
        className="h-full w-full max-w-lg"
        fill="none"
        role="presentation"
      >
        <path
          d="M15 245H445M45 45V265M415 35V265"
          stroke="currentColor"
          strokeOpacity=".12"
        />
        <path
          d="M67 210L172 78H389L284 210H67Z"
          stroke="currentColor"
          strokeOpacity=".5"
        />
        <path
          d="M88 220L172 114M281 219L389 84M284 210L290 242M68 210L60 242"
          stroke="currentColor"
          strokeOpacity=".35"
        />
        <path
          d="M230 78L125 210M285 144H121"
          stroke="currentColor"
          strokeOpacity=".24"
        />
        <path
          d="M119 133L336 133M119 133V151M336 133V151"
          stroke="var(--color-primary)"
          strokeWidth="2"
        />
        <path
          d="M134 138H324M137 143H320M145 133V147M155 133V147M165 133V147M175 133V147M185 133V147M195 133V147M205 133V147M215 133V147M225 133V147M235 133V147M245 133V147M255 133V147M265 133V147M275 133V147M285 133V147M295 133V147M305 133V147M315 133V147"
          stroke="var(--color-primary)"
          strokeOpacity=".35"
        />
        <circle cx="325" cy="60" r="10" fill="var(--color-secondary)" />
        <path
          d="M316 62C261 56 287 18 251 19"
          stroke="var(--color-secondary)"
          strokeOpacity=".5"
          strokeDasharray="3 5"
        />
        <path
          d="M60 70H103M82 49V92M360 232H403M381 210V253"
          stroke="currentColor"
          strokeOpacity=".22"
        />
        <text
          x="64"
          y="274"
          fill="currentColor"
          fillOpacity=".45"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="3"
        >
          {t("THE TABLE IS THE DANCE FLOOR.")}
        </text>
        <text
          x="280"
          y="38"
          fill="currentColor"
          fillOpacity=".35"
          fontFamily="monospace"
          fontSize="8"
          letterSpacing="2"
        >
          41.7151° N
        </text>
      </svg>
      <span className="absolute right-3 top-5 border border-primary px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary rotate-[-5deg]">
        {t("Tbilisi / After hours")}
      </span>
    </div>
  );
}

function TournamentBadge({ status }: { status: TournamentStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`tournament-status tournament-status-${status} technical-label inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] ${status === TournamentStatus.live ? "border-secondary/50 text-secondary" : status === TournamentStatus.upcoming ? "border-primary/35 text-primary" : "border-base-300 text-base-content/40"}`}
    >
      {status === TournamentStatus.live ? (
        <span className="size-1.5 bg-secondary" aria-hidden="true" />
      ) : null}
      {status === TournamentStatus.completed
        ? t("Completed")
        : status === TournamentStatus.live
          ? t("Live now")
          : t("Upcoming")}
    </span>
  );
}

export function TournamentsPage() {
  const { t } = useI18n();
  const { actor, isFetching } = useActor(createActor);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editor, setEditor] = useState<Tournament | "new" | null>(null);
  const [detail, setDetail] = useState<Tournament | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [format, setFormat] = useState(TournamentFormat.singles);
  const [capacity, setCapacity] = useState("16");
  const [status, setStatus] = useState(TournamentStatus.upcoming);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<LocalizedMessage | null>(null);
  const editorRef = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLDialogElement>(null);

  const tournamentsQuery = useQuery({
    queryKey: TOURNAMENTS_QUERY_KEY,
    queryFn: () => {
      if (!actor) throw new Error("The tournament board is still connecting.");
      return tournamentService.list(actor);
    },
    enabled: !!actor && !isFetching,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: TournamentInput) => {
      if (!actor || !isAdmin) throw new Error("Admin access is required.");
      if (!editor) throw new Error("Select a tournament to edit.");
      return editor === "new"
        ? tournamentService.create(actor, input)
        : tournamentService.update(actor, editor.id, input);
    },
    onSuccess: (tournament) => {
      setNotice({
        message: "{title} is saved. See you at the table.",
        params: { title: tournament.title },
      });
      setEditor(null);
      void queryClient.invalidateQueries({ queryKey: TOURNAMENTS_QUERY_KEY });
    },
  });

  useEffect(() => {
    const dialog = editorRef.current;
    if (!dialog) return;
    if (editor && isAdmin) {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    } else if (dialog.open) dialog.close();
  }, [editor, isAdmin]);

  useEffect(() => {
    const dialog = detailRef.current;
    if (!dialog) return;
    if (detail) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [detail]);

  function openEditor(tournament: Tournament | "new") {
    if (!isAdmin) return;
    setTitle(tournament === "new" ? "" : tournament.title);
    setDescription(tournament === "new" ? "" : tournament.description);
    setVenue(tournament === "new" ? "" : tournament.venue);
    setStartsAt(
      tournament === "new" ? "" : toVenueDateTime(tournament.startsAt),
    );
    setFormat(
      tournament === "new" ? TournamentFormat.singles : tournament.format,
    );
    setCapacity(tournament === "new" ? "16" : tournament.capacity.toString());
    setStatus(
      tournament === "new" ? TournamentStatus.upcoming : tournament.status,
    );
    setFormError(null);
    saveMutation.reset();
    setDetail(null);
    setEditor(tournament);
  }

  function closeEditor() {
    if (!saveMutation.isPending) setEditor(null);
  }

  function saveTournament() {
    setFormError(null);
    if (!title.trim() || title.trim().length > 100) {
      setFormError(
        "Tournament title must contain between 1 and 100 characters.",
      );
      return;
    }
    if (!venue.trim() || venue.trim().length > 150) {
      setFormError("Venue must contain between 1 and 150 characters.");
      return;
    }
    if (description.trim().length > 2000) {
      setFormError("Keep the description to 2,000 characters or fewer.");
      return;
    }
    const date = new Date(`${startsAt}:00+04:00`);
    if (!startsAt || !Number.isFinite(date.getTime()) || date.getTime() <= 0) {
      setFormError("Choose a valid start date and time in Tbilisi.");
      return;
    }
    const playerCount = Number(capacity);
    if (!Number.isSafeInteger(playerCount) || playerCount < 2) {
      setFormError("Expected players must be a whole number of at least 2.");
      return;
    }
    saveMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      venue: venue.trim(),
      startsAt: BigInt(date.getTime()) * 1_000_000n,
      format,
      capacity: BigInt(playerCount),
      status,
    });
  }

  const tournaments = tournamentsQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const filteredTournaments = tournaments
    .filter(
      (tournament) =>
        (filter === "all" || tournament.status === filter) &&
        (!query ||
          `${tournament.title} ${tournament.venue} ${tournament.description}`
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) => {
      const priority = { live: 0, upcoming: 1, completed: 2 };
      const byStatus = priority[a.status] - priority[b.status];
      if (byStatus) return byStatus;
      if (a.startsAt === b.startsAt)
        return a.title.localeCompare(b.title, getLocale());
      const byDate = a.startsAt < b.startsAt ? -1 : 1;
      return a.status === TournamentStatus.completed ? -byDate : byDate;
    });
  const upcomingCount = tournaments.filter(
    (tournament) => tournament.status === TournamentStatus.upcoming,
  ).length;
  const liveCount = tournaments.filter(
    (tournament) => tournament.status === TournamentStatus.live,
  ).length;
  const loading =
    tournamentsQuery.isLoading || (isFetching && !tournamentsQuery.data);

  return (
    <div data-ocid="tournaments_page" className="club-page">
      <section className="tournament-hero relative grid gap-4 border-b border-base-300 pb-9 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative z-10">
          <p className="section-kicker mb-5">
            {t("CHILLPONG / TBILISI UNDERGROUND")}
          </p>
          <h1 className="page-title">
            {t("AFTER DARK.")}
            <br />
            <span className="text-primary">{t("GAME ON.")}</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-base-content/60">
            {t("Underground ping-pong. Tbilisi nights.")}
            <br />
            {t("Find your next tournament and meet us at the table.")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a
              href="#tournament-board"
              className="technical-label inline-flex items-center gap-3 text-base-content hover:text-primary"
            >
              {t("Explore tournaments")}{" "}
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
            <span className="h-5 border-l border-base-300" aria-hidden="true" />
            <span className="technical-label text-base-content/40">
              {t("Paddles up. Phones down.")}
            </span>
          </div>
        </div>
        <CourtGraphic />
      </section>

      <section
        id="tournament-board"
        className="scroll-mt-24 pt-9"
        aria-labelledby="tournament-board-title"
      >
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <h2
              id="tournament-board-title"
              className="font-display text-2xl font-bold uppercase tracking-tight"
            >
              {t("The tournament board")}
            </h2>
            <span className="technical-label text-base-content/40">
              {loading
                ? t("Connecting…")
                : t("{v1} upcoming / {v2} live", {
                    v1: upcomingCount,
                    v2: liveCount,
                  })}
            </span>
          </div>
          {isAdmin ? (
            <Button
              data-ocid="tournaments.add_button"
              onClick={() => openEditor("new")}
            >
              <Plus className="size-4" aria-hidden="true" />{" "}
              {t("New tournament")}
            </Button>
          ) : null}
        </header>
        <div className="club-toolbar mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-base-300 py-4">
          <div
            className="flex flex-wrap gap-1"
            aria-label={t("Filter tournaments")}
          >
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                data-ocid={`tournaments.${item}_tab`}
                aria-pressed={filter === item}
                className={`club-filter ${filter === item ? "is-active" : ""}`}
                onClick={() => setFilter(item)}
              >
                {item === "all"
                  ? t("All tournaments")
                  : item === "completed"
                    ? t("Past games")
                    : item === "live"
                      ? t("Live now")
                      : t("Upcoming")}
              </button>
            ))}
          </div>
          <label className="club-search flex w-full items-center gap-3 border border-base-300 px-3 sm:w-64">
            <Search
              className="size-4 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <input
              type="search"
              data-ocid="tournaments.search_input"
              aria-label={t("Search tournaments")}
              placeholder={t("FIND A TOURNAMENT")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-base-content/40"
            />
          </label>
        </div>

        {notice ? (
          <output
            data-ocid="tournaments.success_state"
            className="mb-5 flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
          >
            <Check className="size-4 text-primary" aria-hidden="true" />
            {t(notice)}
          </output>
        ) : null}

        {loading ? (
          <div
            data-ocid="tournaments.loading_state"
            aria-live="polite"
            aria-busy="true"
            aria-label={t("Loading tournaments")}
            className="space-y-3"
          >
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex h-32 animate-pulse items-center gap-6 border border-base-300 p-5"
              >
                <div className="size-16 bg-base-300" />
                <div className="flex-1">
                  <div className="mb-3 h-5 w-1/2 bg-base-300" />
                  <div className="h-3 w-1/3 bg-base-300" />
                </div>
              </div>
            ))}
            <span className="sr-only">
              {t("Loading the tournament board.")}
            </span>
          </div>
        ) : tournamentsQuery.isError ? (
          <div
            data-ocid="tournaments.error_state"
            role="alert"
            className="club-state"
          >
            <AlertTriangle
              className="mb-4 size-7 text-secondary"
              aria-hidden="true"
            />
            <h3 className="font-display text-2xl font-bold uppercase">
              {t("The board is offline.")}
            </h3>
            <p className="mt-2 text-sm text-base-content/60">
              {t("We couldn't load the tournaments. Try connecting again.")}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => void tournamentsQuery.refetch()}
            >
              {t("Try again")}
            </Button>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div data-ocid="tournaments.empty_state" className="club-state">
            <Trophy className="mb-5 size-8 text-primary" aria-hidden="true" />
            <h3 className="font-display text-3xl font-bold uppercase">
              {tournaments.length
                ? t("No games in this corner.")
                : t("The next night is loading.")}
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-base-content/60">
              {tournaments.length
                ? t("Try a different filter or search to find your tournament.")
                : isAdmin
                  ? t(
                      "Set the venue, pick a date and put the first tournament on the board.",
                    )
                  : t(
                      "New tournaments will land here. Check back for the next night at the table.",
                    )}
            </p>
            {tournaments.length ? (
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                {t("Reset filters")}
              </Button>
            ) : isAdmin ? (
              <Button className="mt-6" onClick={() => openEditor("new")}>
                <Plus className="size-4" aria-hidden="true" />{" "}
                {t("New tournament")}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul
            data-ocid="tournaments.list"
            className="divide-y divide-base-300 border-y border-base-300"
          >
            {filteredTournaments.map((tournament, index) => (
              <li
                key={tournament.id.toString()}
                data-ocid={`tournaments.item.${index + 1}`}
                className="tournament-row group grid items-center gap-5 py-6 sm:grid-cols-[5rem_1fr_auto] lg:grid-cols-[5rem_1fr_8rem_auto]"
              >
                <div className="flex items-baseline gap-2 font-mono sm:block sm:border-r sm:border-base-300">
                  <span className="block font-display text-4xl font-bold tracking-tighter text-base-content group-hover:text-primary">
                    {datePart(tournament.startsAt, { day: "2-digit" })}
                  </span>
                  <span className="mt-1 block text-[11px] uppercase tracking-widest text-base-content/45">
                    {datePart(tournament.startsAt, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <TournamentBadge status={tournament.status} />
                    <span className="technical-label text-[10px] text-base-content/35">
                      {t("CP /")} {tournament.id.toString().padStart(3, "0")}
                    </span>
                  </div>
                  <h3 className="break-words font-display text-xl font-bold uppercase tracking-tight sm:text-2xl">
                    <button
                      type="button"
                      data-ocid={`tournaments.title_button.${index + 1}`}
                      className="text-left hover:text-primary"
                      onClick={() => setDetail(tournament)}
                    >
                      {tournament.title}
                    </button>
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-base-content/55">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {tournament.venue}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {eventTime(tournament.startsAt)} {t("Tbilisi")}
                    </span>
                  </div>
                </div>
                <div className="hidden space-y-2 lg:block">
                  <p className="technical-label text-[11px] text-base-content/65">
                    {tournament.format === TournamentFormat.doubles
                      ? t("Doubles")
                      : t("Singles")}
                  </p>
                  <p className="font-mono text-[11px] text-base-content/40">
                    {countLabel(tournament.capacity, "expectedPlayer")}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <a
                    href={`/tournaments/${tournament.id.toString()}`}
                    className="btn btn-primary btn-sm"
                    aria-label={t("Open tournament room for {v1}", {
                      v1: tournament.title,
                    })}
                  >
                    {t("Open room")}{" "}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                  <Button
                    data-ocid={`tournaments.details_button.${index + 1}`}
                    variant="outline"
                    size="sm"
                    onClick={() => setDetail(tournament)}
                  >
                    {t("Details")}{" "}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                    <span className="sr-only">
                      {" "}
                      {t("for")} {tournament.title}
                    </span>
                  </Button>
                  <CopyBracketLink
                    tournamentId={tournament.id}
                    data-ocid={`tournaments.copy_bracket_button.${index + 1}`}
                  />
                  {isAdmin ? (
                    <button
                      type="button"
                      data-ocid={`tournaments.edit_button.${index + 1}`}
                      className="flex items-center gap-1.5 px-2 py-2 font-mono text-[11px] uppercase tracking-wider text-base-content/50 hover:text-primary"
                      onClick={() => openEditor(tournament)}
                    >
                      <Pencil className="size-3" aria-hidden="true" />{" "}
                      {t("Edit")}
                      <span className="sr-only"> {tournament.title}</span>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="technical-label mt-6 text-[10px] text-base-content/35">
          {t("All start times are local to Tbilisi / UTC +04:00")}
        </p>
      </section>

      <dialog
        ref={detailRef}
        data-ocid="tournaments.details_dialog"
        className="modal club-modal"
        aria-labelledby="tournament-detail-title"
        onCancel={(event) => {
          event.preventDefault();
          setDetail(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setDetail(null);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetail(null);
        }}
      >
        {detail ? (
          <div className="modal-box max-w-xl rounded-none border border-base-300 bg-base-200 p-6 sm:p-8">
            <header className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker mb-3">
                  {t("CHILLPONG / TOURNAMENT")}{" "}
                  {detail.id.toString().padStart(3, "0")}
                </p>
                <TournamentBadge status={detail.status} />
              </div>
              <button
                type="button"
                aria-label={t("Close tournament details")}
                className="btn btn-ghost btn-square btn-sm"
                onClick={() => setDetail(null)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <h2
              id="tournament-detail-title"
              className="break-words font-display text-4xl font-bold uppercase tracking-tight"
            >
              {detail.title}
            </h2>
            <dl className="my-7 grid gap-5 border-y border-base-300 py-6 sm:grid-cols-2">
              <div>
                <dt className="technical-label mb-2 flex items-center gap-2 text-base-content/45">
                  <CalendarDays className="size-3.5" aria-hidden="true" />{" "}
                  {t("Date / time")}
                </dt>
                <dd className="text-sm">
                  {datePart(detail.startsAt, {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  <br />
                  {eventTime(detail.startsAt)} {t("/ Tbilisi")}
                </dd>
              </div>
              <div>
                <dt className="technical-label mb-2 flex items-center gap-2 text-base-content/45">
                  <MapPin className="size-3.5" aria-hidden="true" />{" "}
                  {t("Venue")}
                </dt>
                <dd className="break-words text-sm">{detail.venue}</dd>
              </div>
              <div>
                <dt className="technical-label mb-2 flex items-center gap-2 text-base-content/45">
                  <Trophy className="size-3.5" aria-hidden="true" />{" "}
                  {t("Game mode")}
                </dt>
                <dd className="text-sm">
                  {detail.format === TournamentFormat.doubles
                    ? t("Doubles / teams of two")
                    : t("Singles / one vs. one")}
                </dd>
              </div>
              <div>
                <dt className="technical-label mb-2 flex items-center gap-2 text-base-content/45">
                  <Users className="size-3.5" aria-hidden="true" />{" "}
                  {t("Expected players")}
                </dt>
                <dd className="text-sm">
                  {countLabel(detail.capacity, "expectedPlayer")} /{" "}
                  {t("registration stays open")}
                </dd>
              </div>
            </dl>
            {detail.description ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-base-content/70">
                {detail.description}
              </p>
            ) : (
              <p className="text-sm text-base-content/45">
                {t("More details will be announced by the crew.")}
              </p>
            )}
            <footer className="mt-8 flex flex-wrap justify-end gap-3">
              <CopyBracketLink
                key={detail.id.toString()}
                tournamentId={detail.id}
                data-ocid="tournaments.details_copy_bracket_button"
              />
              <Button variant="ghost" onClick={() => setDetail(null)}>
                {t("Close")}
              </Button>
              <a
                href={`/tournaments/${detail.id.toString()}`}
                className="btn btn-primary"
              >
                {t("Open tournament room")}{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
              {isAdmin ? (
                <Button variant="outline" onClick={() => openEditor(detail)}>
                  <Pencil className="size-4" aria-hidden="true" />{" "}
                  {t("Edit tournament")}
                </Button>
              ) : null}
            </footer>
          </div>
        ) : null}
      </dialog>

      <dialog
        ref={editorRef}
        data-ocid="tournaments.dialog"
        className="modal club-modal"
        aria-labelledby="tournament-editor-title"
        onCancel={(event) => {
          event.preventDefault();
          closeEditor();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeEditor();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}
      >
        {editor && isAdmin ? (
          <div className="modal-box max-w-2xl rounded-none border border-base-300 bg-base-200 p-6 sm:p-8">
            <header className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker mb-2">
                  {t("CHILLPONG / SET THE NIGHT")}
                </p>
                <h2
                  id="tournament-editor-title"
                  className="font-display text-3xl font-bold uppercase tracking-tight"
                >
                  {editor === "new"
                    ? t("New tournament.")
                    : t("Edit tournament.")}
                </h2>
              </div>
              <button
                type="button"
                aria-label={t("Close tournament editor")}
                className="btn btn-ghost btn-square btn-sm"
                disabled={saveMutation.isPending}
                onClick={closeEditor}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveTournament();
              }}
            >
              <label className="block">
                <span className="technical-label mb-2 block">
                  {t("Tournament title")}
                </span>
                <input
                  data-ocid="tournaments.title_input"
                  className="input w-full rounded-none"
                  required
                  maxLength={100}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("Give the night a name")}
                />
              </label>
              <label className="block">
                <span className="technical-label mb-2 block">{t("Venue")}</span>
                <input
                  data-ocid="tournaments.venue_input"
                  className="input w-full rounded-none"
                  required
                  maxLength={150}
                  value={venue}
                  onChange={(event) => setVenue(event.target.value)}
                  placeholder={t("Bar name / address")}
                />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Start time / Tbilisi (UTC+04)")}
                  </span>
                  <input
                    data-ocid="tournaments.date_input"
                    type="datetime-local"
                    className="input w-full rounded-none"
                    required
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Expected players")}
                  </span>
                  <input
                    data-ocid="tournaments.capacity_input"
                    type="number"
                    className="input w-full rounded-none"
                    required
                    min={2}
                    step={1}
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                  />
                  <span className="mt-2 block text-xs text-base-content/50">
                    {t("Planning estimate. Registration stays open.")}
                  </span>
                </label>
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Game mode")}
                  </span>
                  <select
                    data-ocid="tournaments.format_select"
                    className="select w-full rounded-none"
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value as TournamentFormat)
                    }
                  >
                    <option value={TournamentFormat.singles}>
                      {t("Singles")}
                    </option>
                    <option value={TournamentFormat.doubles}>
                      {t("Doubles")}
                    </option>
                  </select>
                </label>
                <label className="block">
                  <span className="technical-label mb-2 block">
                    {t("Status")}
                  </span>
                  <select
                    data-ocid="tournaments.status_select"
                    className="select w-full rounded-none"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as TournamentStatus)
                    }
                  >
                    <option value={TournamentStatus.upcoming}>
                      {t("Upcoming")}
                    </option>
                    <option value={TournamentStatus.live}>
                      {t("Live now")}
                    </option>
                    <option value={TournamentStatus.completed}>
                      {t("Completed")}
                    </option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="technical-label mb-2 block">
                  {t("The details / optional")}
                </span>
                <textarea
                  data-ocid="tournaments.description_input"
                  className="textarea w-full rounded-none"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t(
                    "Rules, arrival instructions, entry details. Everything the players need.",
                  )}
                />
              </label>
              {formError || saveMutation.isError ? (
                <p
                  data-ocid="tournaments.form_error"
                  role="alert"
                  className="border border-error/40 px-3 py-3 text-sm text-error"
                >
                  {t(formError) ??
                    (saveMutation.error instanceof Error
                      ? translateError(saveMutation.error.message)
                      : t("Couldn't save this tournament. Try again."))}
                </p>
              ) : null}
              <div className="flex justify-end gap-3 border-t border-base-300 pt-5">
                <Button
                  variant="ghost"
                  disabled={saveMutation.isPending}
                  onClick={closeEditor}
                >
                  {t("Cancel")}
                </Button>
                <Button
                  type="submit"
                  data-ocid="tournaments.save_button"
                  loading={saveMutation.isPending}
                >
                  {editor === "new"
                    ? t("Create tournament")
                    : t("Save changes")}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
