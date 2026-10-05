import { useCallback, useSyncExternalStore } from "react";
import { errorMessages } from "./errors";
import { ka } from "./ka";
import { ru } from "./ru";

export type Language = "en" | "ru" | "ka";
export const LANGUAGE_STORAGE_KEY = "chillpong.language";
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "ka", name: "ქართული" },
] as const;
const locales: Record<Language, string> = {
  en: "en-GB",
  ru: "ru-RU",
  ka: "ka-GE",
};
const catalogs: Record<Language, Record<string, string>> = { en: {}, ru, ka };
const listeners = new Set<() => void>();

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "ru" || value === "ka";
}

function readLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

let language = readLanguage();
export function getLanguage() {
  return language;
}
export function getLocale() {
  return locales[language];
}

function applyLanguage(next: Language) {
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

export function setLanguage(next: Language) {
  if (!isLanguage(next)) return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // The selector still works when storage is unavailable.
  }
  applyLanguage(next);
}

if (typeof window !== "undefined") {
  document.documentElement.lang = language;
  window.addEventListener("storage", (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY)
      applyLanguage(isLanguage(event.newValue) ? event.newValue : "en");
  });
}

export type TranslationParams = Record<string, string | number | bigint>;
export interface LocalizedMessage {
  message: string;
  params: TranslationParams;
}

/** English source messages are the fallback and keep existing UI wording intact. */
export function translate(
  input: string | LocalizedMessage | null | undefined,
  params: TranslationParams = {},
  selected = language,
): string {
  if (input === null || input === undefined) return "";
  const message = typeof input === "string" ? input : input.message;
  const values = typeof input === "string" ? params : input.params;
  const translated = catalogs[selected][message] ?? message;
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    values[key] === undefined ? placeholder : String(values[key]),
  );
}

/** Canister errors include transport diagnostics around the actual validation text. */
export function translateError(message: string): string {
  const key = Object.hasOwn(ru, message)
    ? message
    : errorMessages.find((candidate) => message.includes(candidate));
  return key
    ? translate(key)
    : language === "en"
      ? message
      : translate("Something went wrong. Please try again.");
}

export function translateHistory(caption: string): string {
  const table = /^Match started at table (\d+)$/.exec(caption);
  if (table)
    return translate("Match started at table {table}", { table: table[1] });
  const match = /^(Register|Edit|Withdraw) (.+)$/s.exec(caption);
  return match
    ? translate(`${match[1]} {name}`, { name: match[2] })
    : translate(caption);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useI18n() {
  const selected = useSyncExternalStore(
    subscribe,
    getLanguage,
    () => "en" as const,
  );
  const t = useCallback(
    (
      message: string | LocalizedMessage | null | undefined,
      params?: TranslationParams,
    ) => translate(message, params, selected),
    [selected],
  );
  return {
    language: selected,
    locale: locales[selected],
    t,
    setLanguage,
  };
}
