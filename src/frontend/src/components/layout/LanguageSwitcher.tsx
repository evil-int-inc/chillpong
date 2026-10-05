import { LANGUAGES, useI18n } from "@/i18n";
import { Check, Globe2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="tooltip tooltip-bottom" data-tip={t("Language")}>
        <button
          ref={trigger}
          type="button"
          data-ocid="header.language_button"
          className="btn btn-ghost btn-sm gap-2 px-2"
          aria-label={t("Change language")}
          aria-expanded={open}
          aria-controls="language-options"
          onClick={() => setOpen((value) => !value)}
        >
          <Globe2 className="size-4" aria-hidden="true" />
          <span className="font-mono text-[10px]">
            {language === "ka" ? "GEO" : language.toUpperCase()}
          </span>
        </button>
      </div>
      {open ? (
        <fieldset
          id="language-options"
          className="absolute left-0 top-full z-50 mt-3 w-48 border border-base-300 border-t-primary bg-base-200 p-2 shadow-xl"
        >
          <legend className="sr-only">{t("Language")}</legend>
          {LANGUAGES.map((option) => (
            <label
              key={option.code}
              className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm hover:bg-base-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-primary"
            >
              <span lang={option.code}>{option.name}</span>
              <input
                className="sr-only"
                type="radio"
                name="language"
                value={option.code}
                aria-label={option.name}
                checked={language === option.code}
                onClick={() => {
                  if (language === option.code) {
                    setOpen(false);
                    trigger.current?.focus();
                  }
                }}
                onChange={() => {
                  setLanguage(option.code);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              />
              {language === option.code ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : null}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
