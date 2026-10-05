import { Role, createActor } from "@/backend";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { UserRoleView } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

const USERS_QUERY_KEY = ["adminUsers"] as const;

function isAdminRole(role: Role | undefined): boolean {
  return role === Role.admin;
}

function AdminSkeleton() {
  const rows = Array.from({ length: 5 }, (_, i) => `admin-skeleton-${i}`);
  return (
    <div
      data-ocid="loading_state"
      aria-busy="true"
      className="space-y-3 rounded-box border border-border bg-card p-4"
    >
      {rows.map((id) => (
        <div key={id} className="flex items-center gap-4">
          <Skeleton circle className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function AdminPage() {
  const { actor, isFetching } = useActor(createActor);
  const { principal, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const usersQuery = useQuery<UserRoleView[]>({
    queryKey: [...USERS_QUERY_KEY, principal],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listUsersWithRoles();
    },
    enabled: !!actor && !isFetching && isAdmin,
    refetchInterval: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: async ({
      id,
      grant,
    }: {
      id: UserRoleView["id"];
      grant: boolean;
    }) => {
      if (!actor) throw new Error("Backend is not ready");
      if (!isAdmin) throw new Error("Only admins can manage account access");
      return grant ? actor.grantAdminRole(id) : actor.revokeAdminRole(id);
    },
    onSuccess: (updated, variables) => {
      setNotice(
        variables.grant
          ? `${updated.displayName || updated.id.toString()} is now an admin.`
          : `${updated.displayName || updated.id.toString()} is no longer an admin.`,
      );
      void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["myRole"] });
    },
  });

  const users = usersQuery.data ?? [];
  const adminCount = users.filter((user) => isAdminRole(user.role)).length;
  const searchTerm = search.trim().toLowerCase();
  const visibleUsers = users.filter((user) =>
    user.id.toString().toLowerCase().includes(searchTerm),
  );

  function handleToggle(user: UserRoleView) {
    if (!isAdmin || roleMutation.isPending) return;
    const grant = !isAdminRole(user.role);
    setNotice(null);
    setPendingId(user.id.toString());
    roleMutation.mutate(
      { id: user.id, grant },
      { onSettled: () => setPendingId(null) },
    );
  }

  async function copyPrincipal(id: string) {
    setCopyError(null);
    setCopiedId(null);
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
    } catch {
      setCopyError(
        "Couldn't copy the member ID. You can select and copy it below.",
      );
    }
  }

  if (!isAdmin) return null;

  if (usersQuery.isLoading || (isFetching && !usersQuery.data)) {
    return (
      <div data-ocid="admin_page" className="club-page">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <header className="space-y-1">
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground">
              Admin access
            </h1>
            <p className="text-sm text-muted-foreground">
              Authenticated accounts and their admin access.
            </p>
          </header>
          <AdminSkeleton />
        </div>
      </div>
    );
  }

  if (usersQuery.isError) {
    return (
      <div data-ocid="admin_page" className="club-page">
        <div className="mx-auto w-full max-w-5xl">
          <ErrorState
            title="Couldn't load accounts"
            message="Something went wrong while fetching authenticated accounts."
            onRetry={() => void usersQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-ocid="admin_page" className="club-page">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="section-kicker mb-4">CHILLPONG / CONTROL ROOM</p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground">
              Admin access
            </h1>
            <p className="text-sm text-muted-foreground">
              All signed-in accounts and their member IDs. Assign or revoke
              admin access here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/admin/accounts" className="btn btn-outline btn-sm">
              Edit profiles
            </a>
            <Button
              variant="outline"
              size="sm"
              loading={usersQuery.isFetching}
              onClick={() => void usersQuery.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh accounts
            </Button>
            <span
              data-ocid="admin_count"
              className="inline-flex items-center gap-1.5 rounded-none border border-border bg-base-100 px-3 py-1 text-sm text-muted-foreground"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {users.length} accounts / {adminCount}{" "}
              {adminCount === 1 ? "admin" : "admins"}
            </span>
          </div>
        </header>

        <div className="space-y-2">
          <Input
            type="search"
            label="Search by member ID"
            placeholder="Paste a principal ID or part of it"
            className="font-mono text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            rightElement={<Search className="size-4" aria-hidden="true" />}
          />
          {searchTerm ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {visibleUsers.length} of {users.length} accounts match
            </p>
          ) : null}
        </div>

        {notice ? (
          <output
            data-ocid="success_state"
            className="flex items-center gap-2 rounded-box border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground"
          >
            <CheckCircle2
              className="size-5 shrink-0 text-success"
              aria-hidden="true"
            />
            {notice}
          </output>
        ) : null}

        {roleMutation.isError || copyError ? (
          <div
            data-ocid="error_state"
            role="alert"
            className="flex items-center gap-2 rounded-box border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground"
          >
            <AlertCircle
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>
              {copyError ||
                (roleMutation.error instanceof Error
                  ? roleMutation.error.message
                  : "Couldn't update that role. Please try again.")}
            </span>
          </div>
        ) : null}

        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="size-7" aria-hidden="true" />}
            title="No signed-in accounts yet"
            description="Accounts appear automatically after signing in to ChillPong."
          />
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            icon={<Search className="size-7" aria-hidden="true" />}
            title="No matching member ID"
            description="Try a different principal ID or clear the search."
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            }
          />
        ) : (
          <ul
            data-ocid="admin_user_list"
            className="divide-y divide-border overflow-hidden rounded-box border border-border bg-card"
          >
            {visibleUsers.map((user, index) => {
              const admin = isAdminRole(user.role);
              const isSelf =
                principal !== null && user.id.toString() === principal;
              const isPending = pendingId === user.id.toString();
              return (
                <li
                  key={user.id.toString()}
                  data-ocid={`admin_user.item.${index + 1}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <Avatar
                    name={user.displayName || user.username || "Member"}
                    size="md"
                    alt={`${user.displayName || user.username || "Member"} avatar`}
                  />
                  <div className="min-w-0 space-y-2">
                    <p className="flex items-center gap-2 truncate font-medium text-foreground">
                      <span className="truncate">
                        {user.displayName ||
                          user.username ||
                          "Signed-in member"}
                      </span>
                      {isSelf ? (
                        <span className="shrink-0 rounded-none bg-base-300 px-2 py-0.5 text-xs text-muted-foreground">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {user.username ? `@${user.username}` : "Username not set"}
                    </p>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Member ID / Principal ID
                      </p>
                      <div className="flex items-start gap-2">
                        <code className="min-w-0 break-all font-mono text-xs leading-6 text-foreground select-all">
                          {user.id.toString()}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="btn-xs shrink-0"
                          aria-label={`Copy member ID ${user.id.toString()}`}
                          onClick={() => void copyPrincipal(user.id.toString())}
                        >
                          {copiedId === user.id.toString() ? (
                            <Check
                              className="size-3.5 text-primary"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy className="size-3.5" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="col-start-2 flex flex-wrap items-center gap-3 md:col-start-3 md:row-start-1 md:justify-end">
                    <span
                      data-ocid={`admin_user.role.${index + 1}`}
                      className={
                        admin
                          ? "inline-flex items-center gap-1.5 rounded-none border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                          : "inline-flex items-center gap-1.5 rounded-none border border-border bg-base-100 px-3 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {admin ? (
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ShieldMinus className="size-3.5" aria-hidden="true" />
                      )}
                      {admin ? "Admin" : "Member"}
                    </span>

                    <Button
                      variant={admin ? "outline" : "primary"}
                      size="sm"
                      data-ocid={`admin_user.toggle_button.${index + 1}`}
                      loading={isPending}
                      disabled={roleMutation.isPending || (isSelf && admin)}
                      aria-label={`${admin ? "Revoke admin from" : "Assign admin to"} ${user.id.toString()}`}
                      title={
                        isSelf && admin
                          ? "You can't revoke your own admin role."
                          : undefined
                      }
                      onClick={() => handleToggle(user)}
                    >
                      {admin ? (
                        <>
                          <ShieldMinus className="size-4" aria-hidden="true" />
                          Revoke admin
                        </>
                      ) : (
                        <>
                          <ShieldPlus className="size-4" aria-hidden="true" />
                          Assign admin
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
