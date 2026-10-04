import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";

/** DaisyUI drawer shell adapted from MemeT for ChillPong's route tree. */
export function MainLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="drawer min-h-svh lg:drawer-open">
      <input
        id="sidebar-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(event) => setDrawerOpen(event.target.checked)}
      />

      <div className="drawer-content flex min-w-0 flex-col">
        <Header onOpenSidebar={() => setDrawerOpen(true)} />
        <main
          data-ocid="main_content"
          className="min-h-[calc(100svh-4rem)] min-w-0 flex-1 bg-base-200"
        >
          <Outlet />
        </main>
        <footer className="footer footer-center border-t border-base-300 bg-base-100 px-6 py-4 text-sm text-base-content/60">
          <p>
            © {new Date().getFullYear()} ChillPong. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>

      <div className="drawer-side z-40">
        <button
          type="button"
          aria-label="Close sidebar"
          className="drawer-overlay lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}
