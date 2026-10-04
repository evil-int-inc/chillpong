import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowUpRight,
  LogIn,
  LogOut,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const {
    isAdmin,
    isAuthenticated,
    isInitializing,
    isLoggingIn,
    login,
    logout,
  } = useAuth();
  const items = [
    { label: "Users", to: "/users", icon: Users, number: "01" },
    { label: "Tournaments", to: "/tournaments", icon: Trophy, number: "02" },
    ...(isAdmin
      ? [{ label: "Admin", to: "/admin", icon: ShieldCheck, number: "03" }]
      : []),
  ];
  return (
    <aside
      data-ocid="sidebar"
      className="club-sidebar flex h-svh w-64 flex-col border-r border-base-300 bg-base-100"
    >
      <div className="flex items-start justify-between px-6 pb-8 pt-7">
        <Link
          to="/tournaments"
          onClick={onNavigate}
          aria-label="ChillPong home"
          className="block"
        >
          <img
            src="/logo.jpg"
            alt="ChillPong hedgehog and paddle logo"
            width={64}
            height={64}
            className="size-16 rounded-full object-cover"
          />
          <span className="mt-5 block font-display text-[2rem] font-bold leading-[0.95] tracking-[-0.06em]">
            CHILL
            <br />
            <span className="text-primary">PONG.</span>
          </span>
          <span className="mt-3 block font-mono text-[9px] tracking-[0.18em] text-base-content/50">
            UNDERGROUND PING-PONG CLUB
          </span>
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-square btn-sm lg:hidden"
          onClick={onNavigate}
          aria-label="Close sidebar"
          data-ocid="layout.sidebar_close"
        >
          <X className="size-4" />
        </button>
      </div>
      <nav className="flex-1 px-4" aria-label="Primary">
        <p className="technical-label mb-3 px-3">THE CLUB / INDEX</p>
        <ul className="space-y-2">
          {items.map(({ label, to, icon: Icon, number }) => {
            const active = pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onNavigate}
                  data-ocid="sidebar_link"
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "club-nav-link flex items-center gap-3 px-3 py-3.5",
                    active && "is-active",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  <span className="flex-1 font-display text-sm font-semibold">
                    {label}
                  </span>
                  <span className="font-mono text-[10px] opacity-50">
                    {number}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-6 mb-6 border-t border-base-300 pt-5">
        <div className="mb-6 flex items-center justify-between font-mono text-[10px] tracking-widest text-base-content/50">
          <span>TBILISI, GE</span>
          <ArrowUpRight className="size-4 text-secondary" aria-hidden="true" />
        </div>
        <p className="mb-6 font-display text-lg font-semibold uppercase leading-tight">
          Good people.
          <br />
          Bad backhands.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm w-full"
          onClick={() => {
            if (isAuthenticated) logout();
            else login();
            onNavigate();
          }}
          disabled={isInitializing || isLoggingIn}
          data-ocid={
            isAuthenticated ? "layout.sidebar_logout" : "layout.sidebar_login"
          }
        >
          {isAuthenticated ? (
            <LogOut className="size-4" />
          ) : (
            <LogIn className="size-4" />
          )}
          {isAuthenticated ? "Sign out" : "Sign in"}
        </button>
        <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest text-base-content/35">
          Keep the ball moving.
        </p>
      </div>
    </aside>
  );
}
