import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, Copy, LogIn, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { pathname } = useLocation();
  const {
    isAuthenticated,
    isInitializing,
    isLoggingIn,
    profile,
    login,
    isAdmin,
    principal,
  } = useAuth();
  const [copyNotice, setCopyNotice] = useState("");
  async function copyMemberId() {
    if (!principal) return;
    try {
      await navigator.clipboard.writeText(principal);
      setCopyNotice("Member ID copied.");
    } catch {
      setCopyNotice("Select the Member ID above to copy it.");
    }
  }
  const title =
    pathname === "/players" || pathname === "/users"
      ? "Players"
      : pathname === "/admin/accounts"
        ? "Accounts"
        : pathname === "/admin"
          ? "Admin"
          : pathname.startsWith("/tournaments/")
            ? "Tournament room"
            : "Tournaments";
  return (
    <header
      data-ocid="header"
      className="relative z-30 flex h-20 shrink-0 items-center justify-between gap-3 border-b border-base-300 bg-base-100 px-5 sm:px-8"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost btn-square lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          data-ocid="layout.sidebar_toggle"
        >
          <Menu className="size-5" />
        </button>
        <Link
          to="/tournaments"
          aria-label="ChillPong home"
          className="shrink-0"
        >
          <img
            src="/logo.jpg"
            alt=""
            width={34}
            height={34}
            className="size-9 rounded-full"
          />
        </Link>
        <div className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] sm:flex">
          <span className="text-base-content/40">CHILL PONG</span>
          <span className="text-base-content/25">/</span>
          <span>{title}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="hidden items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-base-content/50 xl:flex">
          <span className="size-1.5 bg-secondary" />
          TBILISI / AFTER HOURS
        </span>
        {isAuthenticated ? (
          <details className="dropdown dropdown-end border-l border-base-300 pl-3">
            <summary
              data-ocid="layout.user_identity"
              aria-label="Account details"
              className="btn btn-ghost flex items-center gap-2.5 px-1 normal-case"
            >
              <Avatar
                src={profile?.avatar?.getDirectURL()}
                name={profile?.displayName || "Member"}
                size="sm"
              />
              <span className="hidden max-w-36 truncate text-sm sm:block">
                {profile?.displayName || "Club member"}
              </span>
              {isAdmin ? (
                <ShieldCheck
                  className="size-4 text-primary"
                  aria-label="Admin account"
                />
              ) : null}
            </summary>
            <div className="dropdown-content z-50 mt-4 w-72 border border-base-300 bg-base-200 p-5 shadow-lg">
              <p className="technical-label mb-3 text-base-content/60">
                Your Member ID
              </p>
              <code className="block select-all break-all font-mono text-xs leading-relaxed">
                {principal}
              </code>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-4 w-full"
                onClick={() => void copyMemberId()}
                disabled={!principal}
              >
                <Copy className="size-3.5" />
                Copy member ID
              </button>
              <p className="mt-3 text-xs text-base-content/60">
                Share this ID with an admin to join the lineup.
              </p>
              <output
                className="mt-2 block text-xs text-primary"
                aria-live="polite"
              >
                {copyNotice}
              </output>
            </div>
          </details>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            onClick={() => login()}
            disabled={isInitializing || isLoggingIn}
            data-ocid="sign_in_button"
          >
            <LogIn className="size-4" />
            <span>Sign in</span>
            <ArrowUpRight className="hidden size-3.5 sm:block" />
          </button>
        )}
      </div>
    </header>
  );
}
