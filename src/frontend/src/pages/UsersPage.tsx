import { Role, type User, createActor } from "@/backend";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/users";
import { useActor } from "@caffeineai/core-infrastructure";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const USERS_QUERY_KEY = ["users"] as const;

function memberInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function memberDate(timestamp: bigint) {
  return new Date(Number(timestamp / 1_000_000n)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Tbilisi",
  });
}

export function UsersPage() {
  const { actor, isFetching } = useActor(createActor);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin">("all");
  const [editor, setEditor] = useState<User | "new" | null>(null);
  const [principalText, setPrincipalText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepsExistingUsername =
    editor !== null &&
    editor !== "new" &&
    username.trim() === editor.username.trim();

  const usersQuery = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => {
      if (!actor) throw new Error("The club directory is still connecting.");
      return userService.list(actor);
    },
    enabled: !!actor && !isFetching,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!actor || !isAdmin) throw new Error("Admin access is required.");
      if (!editor) throw new Error("Select a member to edit.");
      const memberId = Principal.fromText(principalText.trim());
      const input = {
        displayName: displayName.trim(),
        username: keepsExistingUsername
          ? editor.username
          : username.trim().toLowerCase(),
        bio: bio.trim() || undefined,
      };
      return editor === "new"
        ? userService.create(actor, memberId, input)
        : userService.update(actor, memberId, input);
    },
    onSuccess: (user) => {
      setNotice(`${user.displayName}'s member details are saved.`);
      setEditor(null);
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editor && isAdmin) {
      if (!dialog.open) dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input:not([readonly])")?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [editor, isAdmin]);

  function openEditor(user: User | "new") {
    if (!isAdmin) return;
    setPrincipalText(user === "new" ? "" : user.id.toString());
    setDisplayName(user === "new" ? "" : user.displayName);
    setUsername(user === "new" ? "" : user.username);
    setBio(user === "new" ? "" : (user.bio ?? ""));
    setFormError(null);
    saveMutation.reset();
    setEditor(user);
  }

  function closeEditor() {
    if (!saveMutation.isPending) setEditor(null);
  }

  function saveUser() {
    setFormError(null);
    try {
      const principal = Principal.fromText(principalText.trim());
      if (principal.isAnonymous()) {
        setFormError(
          "Use the member's signed-in principal, not an anonymous identity.",
        );
        return;
      }
    } catch {
      setFormError(
        "Enter a valid Internet Identity principal for this member.",
      );
      return;
    }
    if (!displayName.trim() || displayName.trim().length > 80) {
      setFormError("Display name must contain between 1 and 80 characters.");
      return;
    }
    if (
      !keepsExistingUsername &&
      !/^[a-z0-9_-]{3,30}$/.test(username.trim().toLowerCase())
    ) {
      setFormError(
        "Username needs 3–30 letters, numbers, underscores or hyphens.",
      );
      return;
    }
    if (bio.trim().length > 500) {
      setFormError("Keep the bio to 500 characters or fewer.");
      return;
    }
    saveMutation.mutate();
  }

  const users = usersQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const filteredUsers = users
    .filter(
      (user) =>
        (roleFilter === "all" || user.role === Role.admin) &&
        (!query ||
          `${user.displayName} ${user.username} ${user.bio ?? ""}`
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const loading = usersQuery.isLoading || (isFetching && !usersQuery.data);

  return (
    <div data-ocid="users_page" className="club-page">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="section-kicker mb-4">CHILLPONG / THE PEOPLE</p>
          <h1 className="page-title">
            THE LOCAL
            <br />
            <span className="text-primary">LINEUP.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-base-content/60">
            Familiar faces. New challengers. The people who keep the tables
            moving.
          </p>
        </div>
        {isAdmin ? (
          <Button
            data-ocid="users.add_button"
            onClick={() => openEditor("new")}
          >
            <Plus className="size-4" aria-hidden="true" /> Add user
          </Button>
        ) : (
          <span className="technical-label flex items-center gap-2 border-l border-primary pl-4">
            <Users className="size-4 text-primary" aria-hidden="true" />
            {loading ? "Connecting" : `${users.length} club members`}
          </span>
        )}
      </header>

      <div className="club-toolbar mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-base-300 py-4">
        <div className="flex gap-1" aria-label="Filter members">
          {(["all", "admin"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              data-ocid={`users.${filter}_tab`}
              aria-pressed={roleFilter === filter}
              className={`club-filter ${roleFilter === filter ? "is-active" : ""}`}
              onClick={() => setRoleFilter(filter)}
            >
              {filter === "all" ? "All users" : "Admins"}
              <span className="ml-2 opacity-50">
                {filter === "all"
                  ? users.length
                  : users.filter((user) => user.role === Role.admin).length}
              </span>
            </button>
          ))}
        </div>
        <label className="club-search flex w-full items-center gap-3 border border-base-300 px-3 sm:w-72">
          <Search
            className="size-4 shrink-0 text-base-content/45"
            aria-hidden="true"
          />
          <input
            type="search"
            data-ocid="users.search_input"
            aria-label="Search users"
            placeholder="FIND YOUR PEOPLE"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-base-content/40"
          />
        </label>
      </div>

      {notice ? (
        <output
          data-ocid="users.success_state"
          className="mb-5 flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
        >
          <Check className="size-4 text-primary" aria-hidden="true" /> {notice}
        </output>
      ) : null}

      {loading ? (
        <div
          data-ocid="users.loading_state"
          aria-live="polite"
          aria-busy="true"
          aria-label="Loading users"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse border border-base-300 bg-base-200 p-6"
            >
              <div className="mb-6 size-12 bg-base-300" />
              <div className="mb-3 h-4 w-2/3 bg-base-300" />
              <div className="h-3 w-1/3 bg-base-300" />
            </div>
          ))}
          <span className="sr-only">Loading the member directory.</span>
        </div>
      ) : usersQuery.isError ? (
        <div data-ocid="users.error_state" role="alert" className="club-state">
          <AlertTriangle
            className="mb-4 size-7 text-secondary"
            aria-hidden="true"
          />
          <h2 className="font-display text-2xl font-bold uppercase">
            Directory unavailable.
          </h2>
          <p className="mt-2 text-sm text-base-content/60">
            We couldn't load the club members. Try connecting again.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => void usersQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div data-ocid="users.empty_state" className="club-state">
          <Users className="mb-4 size-8 text-primary" aria-hidden="true" />
          <h2 className="font-display text-3xl font-bold uppercase">
            {users.length ? "No matches." : "The lineup starts here."}
          </h2>
          <p className="mt-3 max-w-md text-sm text-base-content/60">
            {users.length
              ? "Try another name or switch the member filter."
              : isAdmin
                ? "Add the first members and build the ChillPong community."
                : "Club members will appear here once the crew is added."}
          </p>
          {users.length ? (
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
              }}
            >
              Reset filters
            </Button>
          ) : isAdmin ? (
            <Button className="mt-6" onClick={() => openEditor("new")}>
              <Plus className="size-4" aria-hidden="true" /> Add user
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="technical-label mb-4 text-base-content/45">
            {filteredUsers.length}{" "}
            {filteredUsers.length === 1 ? "person" : "people"} / IN THE CLUB
          </p>
          <ul
            data-ocid="users.list"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filteredUsers.map((user, index) => (
              <li
                key={user.id.toString()}
                data-ocid={`users.item.${index + 1}`}
                className="member-panel flex min-w-0 flex-col border border-base-300 bg-base-200/30 p-6"
              >
                <div className="mb-7 flex items-start justify-between gap-3">
                  <div className="member-avatar flex size-14 shrink-0 items-center justify-center overflow-hidden border border-base-300 bg-base-300 font-display text-xl font-bold text-primary">
                    {user.avatar ? (
                      <img
                        src={user.avatar.getDirectURL()}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      memberInitials(user.displayName)
                    )}
                  </div>
                  {user.role === Role.admin ? (
                    <span className="technical-label flex items-center gap-1.5 text-primary">
                      <ShieldCheck className="size-3.5" aria-hidden="true" />{" "}
                      Admin
                    </span>
                  ) : (
                    <ArrowUpRight
                      className="size-4 text-base-content/25"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <h2 className="break-words font-display text-xl font-bold uppercase tracking-tight">
                  {user.displayName}
                </h2>
                <p className="mt-1 break-words font-mono text-xs text-base-content/50">
                  @{user.username}
                </p>
                {user.bio ? (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-base-content/65">
                    {user.bio}
                  </p>
                ) : null}
                <div className="mt-6 flex items-center justify-between gap-3 border-t border-base-300 pt-4">
                  <span className="technical-label text-[10px] text-base-content/40">
                    Joined {memberDate(user.createdAt)}
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      data-ocid={`users.edit_button.${index + 1}`}
                      className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:underline"
                      onClick={() => openEditor(user)}
                    >
                      <Pencil className="size-3" aria-hidden="true" /> Edit
                      <span className="sr-only"> {user.displayName}</span>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <dialog
        ref={dialogRef}
        data-ocid="users.dialog"
        className="modal club-modal"
        aria-labelledby="user-dialog-title"
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
          <div className="modal-box max-w-xl rounded-none border border-base-300 bg-base-200 p-6 sm:p-8">
            <header className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker mb-2">CHILLPONG / MEMBER FILE</p>
                <h2
                  id="user-dialog-title"
                  className="font-display text-3xl font-bold uppercase tracking-tight"
                >
                  {editor === "new" ? "Add to the lineup." : "Edit member."}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close member editor"
                className="btn btn-ghost btn-square btn-sm"
                disabled={saveMutation.isPending}
                onClick={closeEditor}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveUser();
              }}
              className="space-y-5"
            >
              <label className="block">
                <span className="technical-label mb-2 block">
                  Member principal
                </span>
                {editor === "new" ? (
                  <span className="mb-3 block text-xs leading-relaxed text-base-content/60">
                    Ask the member to sign in and copy their Member ID from the
                    account menu.
                  </span>
                ) : null}
                <input
                  data-ocid="users.principal_input"
                  className="input w-full rounded-none font-mono text-sm"
                  required
                  value={principalText}
                  readOnly={editor !== "new"}
                  onChange={(event) => setPrincipalText(event.target.value)}
                  placeholder="xxxxx-xxxxx-xxxxx-xxxxx-cai"
                />
                <span className="mt-2 block text-xs text-base-content/50">
                  {editor === "new"
                    ? "Use the principal shown to this member after signing in."
                    : "This identity stays attached to the member."}
                </span>
              </label>
              <label className="block">
                <span className="technical-label mb-2 block">Display name</span>
                <input
                  data-ocid="users.name_input"
                  className="input w-full rounded-none"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Name on the table"
                />
              </label>
              <label className="block">
                <span className="technical-label mb-2 block">Username</span>
                <input
                  data-ocid="users.username_input"
                  className="input w-full rounded-none font-mono"
                  required
                  minLength={keepsExistingUsername ? undefined : 3}
                  maxLength={30}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="your-handle"
                />
                <span className="mt-2 block text-xs text-base-content/50">
                  {keepsExistingUsername
                    ? "Keep this handle, or choose a new one."
                    : "3–30 letters, numbers, underscores or hyphens. Saved in lowercase."}
                </span>
              </label>
              <label className="block">
                <span className="technical-label mb-2 block">
                  Bio / optional
                </span>
                <textarea
                  data-ocid="users.bio_input"
                  className="textarea w-full rounded-none"
                  rows={3}
                  maxLength={500}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="A few words about this member."
                />
              </label>
              {formError || saveMutation.isError ? (
                <p
                  data-ocid="users.form_error"
                  role="alert"
                  className="border border-error/40 px-3 py-3 text-sm text-error"
                >
                  {formError ??
                    (saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "Couldn't save this member. Try again.")}
                </p>
              ) : null}
              <div className="flex justify-end gap-3 border-t border-base-300 pt-5">
                <Button
                  variant="ghost"
                  disabled={saveMutation.isPending}
                  onClick={closeEditor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-ocid="users.save_button"
                  loading={saveMutation.isPending}
                >
                  {editor === "new" ? "Add user" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
