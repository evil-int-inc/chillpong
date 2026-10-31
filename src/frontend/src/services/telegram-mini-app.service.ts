export interface TelegramMiniAppApi {
  version?: string;
  platform?: string;
  isVerticalSwipesEnabled: boolean;
  disableVerticalSwipes(): void;
  enableVerticalSwipes(): void;
}

const SWIPE_EVENT = "web_app_setup_swipe_behavior";
const TELEGRAM_WEB_ORIGIN = "https://web.telegram.org";

interface MiniAppLaunch {
  version?: string;
  platform?: string;
}

/** Scope Telegram's native swipe policy without replacing its login bridge. */
export class TelegramMiniAppService {
  private locks = 0;
  private restore?: () => void;
  // The router can remove launch parameters when opening a shared bracket URL.
  private readonly launch = this.readLaunchParameters();

  /** UI environment detection only; account authentication still uses verified proofs. */
  isInTelegramMiniApp(): boolean {
    if (typeof window === "undefined") return false;
    if (this.hasLaunchContext(window.Telegram?.WebApp)) return true;

    const current = this.readLaunchParameters();
    if (
      !this.hasLaunchContext({
        version: current.version ?? this.launch.version,
        platform: current.platform ?? this.launch.platform,
      })
    )
      return false;

    // A login widget, a generic iframe, or external.notify alone is not a
    // Mini App. Require Telegram launch metadata together with a host transport.
    return (
      typeof window.TelegramWebviewProxy?.postEvent === "function" ||
      typeof (window.external as External & { notify?: unknown })?.notify ===
        "function" ||
      window.parent !== window
    );
  }

  private readLaunchParameters(): MiniAppLaunch {
    if (typeof window === "undefined") return {};
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    return {
      version: parameters.get("tgWebAppVersion") ?? undefined,
      platform: parameters.get("tgWebAppPlatform") ?? undefined,
    };
  }

  private hasLaunchContext(context?: MiniAppLaunch): boolean {
    return (
      /^\d+\.\d+(?:\.\d+)?$/.test(context?.version ?? "") &&
      !!context?.platform?.trim() &&
      context.platform.trim() !== "unknown"
    );
  }

  protectBracketGestures(): () => void {
    if (!this.isInTelegramMiniApp()) return () => {};
    if (!this.locks) {
      const restore = this.disableVerticalSwipes();
      if (!restore) return () => {};
      this.restore = restore;
    }
    this.locks += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.locks -= 1;
      if (this.locks) return;
      const restore = this.restore;
      this.restore = undefined;
      try {
        restore?.();
      } catch {
        // A closing or older Telegram host must not interrupt app navigation.
      }
    };
  }

  private disableVerticalSwipes(): (() => void) | undefined {
    if (typeof window === "undefined") return;
    const app = window.Telegram?.WebApp;
    const version =
      app?.version ??
      new URLSearchParams(window.location.hash.slice(1)).get(
        "tgWebAppVersion",
      ) ??
      this.launch.version;
    if (version) {
      const [major, minor = 0] = version.split(".").map(Number);
      if (
        !Number.isFinite(major) ||
        !Number.isFinite(minor) ||
        major < 7 ||
        (major === 7 && minor < 7)
      )
        return;
    }
    try {
      if (
        app &&
        app.platform !== "unknown" &&
        typeof app.disableVerticalSwipes === "function" &&
        typeof app.enableVerticalSwipes === "function"
      ) {
        if (!app.isVerticalSwipesEnabled) return () => {};
        app.disableVerticalSwipes();
        return () => app.enableVerticalSwipes();
      }

      // These are the transports used by Telegram's official WebApp SDK.
      // Sending only the swipe event avoids loading a second SDK that could
      // replace Telegram.Login's native event handlers.
      const proxy = window.TelegramWebviewProxy;
      if (typeof proxy?.postEvent === "function") {
        const toggle = (enabled: boolean) =>
          proxy.postEvent(
            SWIPE_EVENT,
            JSON.stringify({ allow_vertical_swipe: enabled }),
          );
        toggle(false);
        return () => toggle(true);
      }
      const external = window.external as External & {
        notify?: (message: string) => void;
      };
      if (typeof external?.notify === "function") {
        const toggle = (enabled: boolean) =>
          external.notify?.(
            JSON.stringify({
              eventType: SWIPE_EVENT,
              eventData: { allow_vertical_swipe: enabled },
            }),
          );
        toggle(false);
        return () => toggle(true);
      }
      if (window.parent !== window && version) {
        const parent = window.parent;
        const toggle = (enabled: boolean) =>
          parent.postMessage(
            JSON.stringify({
              eventType: SWIPE_EVENT,
              eventData: { allow_vertical_swipe: enabled },
            }),
            TELEGRAM_WEB_ORIGIN,
          );
        toggle(false);
        return () => toggle(true);
      }
    } catch {
      // Ordinary browsers and hosts without this API keep existing gestures.
    }
  }
}

export const telegramMiniAppService = new TelegramMiniAppService();
