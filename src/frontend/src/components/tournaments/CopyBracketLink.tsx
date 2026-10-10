import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { bracketUrl } from "@/types/bracket-link";
import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CopyBracketLinkProps {
  tournamentId: bigint | string;
  compact?: boolean;
  className?: string;
  "data-ocid"?: string;
}

export function CopyBracketLink({
  tournamentId,
  compact = false,
  className,
  "data-ocid": ocid,
}: CopyBracketLinkProps) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">(
    "idle",
  );
  const attempt = useRef(0);
  const url = bracketUrl(tournamentId);
  const previousUrl = useRef(url);

  useEffect(() => {
    if (previousUrl.current !== url) {
      previousUrl.current = url;
      setState("idle");
    }
    return () => {
      attempt.current += 1;
    };
  }, [url]);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 3000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    const currentAttempt = ++attempt.current;
    setState("copying");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (attempt.current === currentAttempt) setState("copied");
    } catch {
      if (attempt.current === currentAttempt) setState("failed");
    }
  }

  return (
    <div className={cn("inline-flex max-w-full flex-col gap-2", className)}>
      <Button
        variant="outline"
        size={compact ? "icon" : "sm"}
        data-ocid={ocid}
        aria-label={t("Copy bracket link")}
        title={t(
          state === "copied" ? "Bracket link copied" : "Copy bracket link",
        )}
        loading={state === "copying"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void copy();
        }}
      >
        {state === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
        {!compact
          ? t(state === "copied" ? "Bracket link copied" : "Copy bracket link")
          : null}
      </Button>
      <output aria-live="polite" className="sr-only">
        {state === "copied" ? t("Bracket link copied") : ""}
      </output>
      {state === "failed" ? (
        <div role="alert" className="max-w-sm text-xs text-base-content/65">
          <p className="mb-2">{t("Could not copy the link. Copy it below.")}</p>
          <input
            type="url"
            readOnly
            aria-label={t("Full bracket URL")}
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.stopPropagation()}
            className="w-full border border-base-300 bg-base-100 px-2 py-2 font-mono text-xs text-base-content outline-none focus:border-primary"
          />
        </div>
      ) : null}
    </div>
  );
}
