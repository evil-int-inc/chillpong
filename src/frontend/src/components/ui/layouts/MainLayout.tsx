import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useI18n } from "@/i18n";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";

export function MainLayout() {
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="drawer min-h-svh overflow-x-clip lg:drawer-open">
      <input
        id="sidebar-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(event) => setDrawerOpen(event.target.checked)}
        aria-label={t("Sidebar visibility")}
      />
      <div className="drawer-content flex min-w-0 flex-col">
        <Header onOpenSidebar={() => setDrawerOpen(true)} />
        <main data-ocid="main_content" className="club-content min-w-0 flex-1">
          <Outlet />
        </main>
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
      </div>
      <div className="drawer-side z-40">
        <button
          type="button"
          aria-label={t("Close sidebar")}
          className="drawer-overlay lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}
