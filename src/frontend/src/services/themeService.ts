import { THEME_STORAGE_KEY } from "@/config";

export type DaisyTheme = "lofi" | "black";
export type ThemeChoice = "system" | DaisyTheme;

/** DaisyUI theme persistence, resolution, and document application. */
export class ThemeService {
  canDetectSystemTheme(): boolean {
    return (
      typeof window !== "undefined" && typeof window.matchMedia === "function"
    );
  }

  getTimeBasedTheme(date = new Date()): DaisyTheme {
    const hour = date.getHours();
    return hour >= 7 && hour < 20 ? "lofi" : "black";
  }

  getSystemTheme(): DaisyTheme {
    if (!this.canDetectSystemTheme()) return this.getTimeBasedTheme();
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "black"
      : "lofi";
  }

  getStoredThemeChoice(): ThemeChoice {
    if (typeof window === "undefined") return "system";
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "lofi" ||
      storedTheme === "black" ||
      storedTheme === "system"
      ? storedTheme
      : "system";
  }

  resolveTheme(choice: ThemeChoice): DaisyTheme {
    return choice === "system" ? this.getSystemTheme() : choice;
  }

  applyTheme(theme: DaisyTheme): void {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme =
      theme === "black" ? "dark" : "light";
  }

  setThemeChoice(choice: ThemeChoice): DaisyTheme {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    const theme = this.resolveTheme(choice);
    this.applyTheme(theme);
    return theme;
  }

  /** Applies the saved or resolved system theme before React renders. */
  initialize(): DaisyTheme {
    const theme = this.resolveTheme(this.getStoredThemeChoice());
    this.applyTheme(theme);
    return theme;
  }
}

export const themeService = new ThemeService();
