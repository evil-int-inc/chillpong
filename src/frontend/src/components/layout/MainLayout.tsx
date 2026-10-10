import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useI18n } from "@/i18n";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

export function MainLayout() {
  const { t } = useI18n();
  const fullscreen = useRouterState({
    select: (state) =>
      /^\/tournaments\/\d+\/?$/.test(state.location.pathname) &&
      state.location.search.view === "bracket",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div
      className={
        fullscreen
          ? "h-dvh overflow-hidden"
          : "drawer min-h-svh overflow-x-clip lg:drawer-open"
      }
    >
      {!fullscreen ? (
        <input
          id="sidebar-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={drawerOpen}
          onChange={(event) => setDrawerOpen(event.target.checked)}
          aria-label={t("Sidebar visibility")}
        />
      ) : null}
      <div
        className={`flex min-w-0 flex-col ${fullscreen ? "h-full" : "drawer-content"}`}
      >
        {!fullscreen ? (
          <Header onOpenSidebar={() => setDrawerOpen(true)} />
        ) : null}
        <main
          data-ocid="main_content"
          className={
            fullscreen
              ? "min-h-0 flex-1 overflow-hidden"
              : "club-content min-w-0 flex-1"
          }
        >
          <Outlet />
        </main>
        {!fullscreen ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-base-300 bg-base-100 px-6 py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-base-content/40 sm:px-8">
            <span>
              © {new Date().getFullYear()} {t("ChillPong / Tbilisi")}
            </span>
            <span>{t("Serve. Rally. Repeat.")}</span>
            <a
              href="https://caffeine.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              {t("Built with caffeine.ai ↗")}
            </a>
          </footer>
        ) : null}
      </div>
      {!fullscreen ? (
        <div className="drawer-side z-40">
          <button
            type="button"
            aria-label={t("Close sidebar")}
            className="drawer-overlay lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
