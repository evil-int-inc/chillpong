import { NotificationBell } from "@/components/common/NotificationBell";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/hooks/useAuth";
import { type ThemeChoice, useTheme } from "@/hooks/useTheme";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Upload,
  User,
} from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onOpenSidebar: () => void;
}

const themeOptions: Array<{
  choice: ThemeChoice;
  label: string;
  icon: typeof Monitor;
}> = [
  { choice: "system", label: "Follow system", icon: Monitor },
  { choice: "lofi", label: "Light", icon: Sun },
  { choice: "black", label: "Dark", icon: Moon },
];

export function Header({ onOpenSidebar }: HeaderProps) {
  const { isAuthenticated, isInitializing, login, logout, profile, isAdmin } =
    useAuth();
  const { theme, themeChoice, setThemeChoice } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    void navigate({ to: "/feed", search: { q: term } });
    setQuery("");
  }

  const displayName =
    profile?.displayName ?? profile?.username ?? "Your channel";
  const avatarUrl = profile?.avatar?.getDirectURL();
  const ThemeIcon =
    themeChoice === "system" ? Monitor : theme === "black" ? Moon : Sun;

  const searchForm = (
    <form onSubmit={submitSearch} className="w-full">
      <label className="input input-bordered flex w-full items-center gap-2 rounded-full bg-base-200">
        <Search className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search videos"
          aria-label="Search videos"
          data-ocid="search_input"
          className="grow"
        />
      </label>
    </form>
  );

  return (
    <header
      data-ocid="header"
      className="navbar sticky top-0 z-30 min-h-16 gap-2 border-b border-base-300 bg-base-100 px-3 shadow-sm sm:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="btn btn-ghost btn-square lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          data-ocid="layout.sidebar_toggle"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <Link
          to="/feed"
          aria-label="ChillPong home"
          className="flex shrink-0 items-center gap-2 lg:hidden"
        >
          <img
            src="/logo.jpg"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-lg object-cover"
          />
          <span className="hidden text-lg font-bold tracking-tight min-[420px]:inline sm:hidden">
            Chill<span className="text-brand">Pong</span>
          </span>
        </Link>

        {isAuthenticated && profile ? (
          <div
            className="hidden min-w-0 items-center gap-2 lg:flex"
            data-ocid="layout.user_identity"
          >
            <Avatar
              src={avatarUrl}
              name={displayName}
              alt={displayName}
              size="sm"
            />
            <span className="max-w-40 truncate text-sm font-medium">
              {displayName}
            </span>
          </div>
        ) : null}

        <div className="mx-auto hidden w-full max-w-xl sm:block">
          {searchForm}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="dropdown dropdown-end sm:hidden">
          <button
            type="button"
            tabIndex={0}
            className="btn btn-ghost btn-square btn-sm"
            aria-label="Search"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
          <div className="dropdown-content z-50 mt-2 w-[calc(100vw-1rem)] max-w-sm rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
            {searchForm}
          </div>
        </div>

        <Link
          to="/upload"
          data-ocid="upload_button"
          aria-label="Upload video"
          className="btn btn-primary btn-sm hidden gap-2 sm:inline-flex"
        >
          <Upload className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">Upload</span>
        </Link>

        <NotificationBell />

        <div className="dropdown dropdown-end">
          <button
            type="button"
            tabIndex={0}
            className="btn btn-ghost btn-square btn-sm"
            aria-label="Theme selector"
            title="Theme selector"
            data-ocid="layout.theme_toggle"
          >
            <ThemeIcon className="size-4" aria-hidden="true" />
          </button>
          <ul className="menu dropdown-content z-50 mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
            {themeOptions.map(({ choice, label, icon: Icon }) => (
              <li key={choice}>
                <button
                  type="button"
                  className={themeChoice === choice ? "menu-active" : ""}
                  onClick={() => setThemeChoice(choice)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {themeChoice === choice ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {isInitializing ? (
          <div className="skeleton size-9 rounded-full" aria-hidden="true" />
        ) : isAuthenticated ? (
          <div className="dropdown dropdown-end">
            <button
              type="button"
              tabIndex={0}
              data-ocid="avatar_menu_button"
              aria-label="Account menu"
              className="btn btn-ghost btn-circle"
            >
              <Avatar
                src={avatarUrl}
                name={displayName}
                alt={displayName}
                size="sm"
              />
            </button>
            <ul
              data-ocid="avatar_menu"
              className="menu dropdown-content z-50 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg"
            >
              <li className="menu-title block border-b border-base-300 px-3 py-2 normal-case">
                <span className="block truncate text-sm font-medium text-base-content">
                  {displayName}
                </span>
                <span className="block truncate text-xs font-normal text-base-content/60">
                  {profile?.username ? `@${profile.username}` : "Your channel"}
                </span>
              </li>
              <li>
                <Link to="/profile" data-ocid="profile_link">
                  <User className="size-4" aria-hidden="true" />
                  Your profile
                </Link>
              </li>
              {isAdmin ? (
                <li>
                  <Link to="/admin" data-ocid="admin_link">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    Admin
                  </Link>
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  data-ocid="logout_button"
                  onClick={() => logout()}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-neutral btn-sm gap-2"
            onClick={() => login()}
            data-ocid="sign_in_button"
          >
            <LogIn className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        )}
      </div>
    </header>
  );
}
