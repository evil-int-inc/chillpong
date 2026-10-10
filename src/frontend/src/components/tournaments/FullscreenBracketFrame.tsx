import { useI18n } from "@/i18n";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { CopyBracketLink } from "./CopyBracketLink";

export function FullscreenBracketFrame({
  tournamentId,
  title,
  onClose,
  children,
}: {
  tournamentId: bigint;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      data-ocid="tournament.fullscreen_view"
      className="flex h-full min-h-0 flex-col gap-3 bg-base-100 p-3 sm:p-5"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-base-300 pb-3 sm:gap-4">
        <Link
          to="/tournaments"
          aria-label={t("ChillPong home")}
          className="shrink-0"
        >
          <img
            src="/logo.jpg"
            alt=""
            className="size-9 rounded-full sm:size-11"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="technical-label mb-1 text-[9px] text-primary">
            CHILLPONG / {t("Full bracket")}
          </p>
          <h1 className="truncate font-display text-lg font-bold uppercase sm:text-2xl">
            {title ?? t("Complete tournament bracket")}
          </h1>
        </div>
        <CopyBracketLink tournamentId={tournamentId} compact />
        <button
          type="button"
          data-ocid="tournament.close_fullscreen_button"
          className="btn btn-ghost btn-square btn-sm shrink-0"
          aria-label={t("Close fullscreen bracket")}
          title={t("Close fullscreen bracket")}
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>
      {children}
    </div>
  );
}
