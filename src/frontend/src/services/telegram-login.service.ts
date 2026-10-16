export interface TelegramLoginResult {
  id_token?: string;
  error?: string;
}

export interface TelegramLoginOptions {
  client_id: number;
  nonce: string;
  scope: ["profile"];
  lang: string;
}

export interface TelegramLoginSdk {
  auth(
    options: TelegramLoginOptions,
    callback: (result: TelegramLoginResult) => void,
  ): void;
  close(): void;
}

declare global {
  interface Window {
    Telegram?: { Login?: TelegramLoginSdk };
    TelegramWebviewProxy?: {
      postEvent(eventType: string, eventData: string): void;
    };
  }
}

const TELEGRAM_ORIGIN = "https://oauth.telegram.org";
const SDK_URL = "https://oauth.telegram.org/js/telegram-login.js?6";
class BrowserTelegramLogin implements TelegramLoginSdk {
  private dispose: (() => void) | undefined;

  close(): void {
    const cleanup = this.dispose;
    this.dispose = undefined;
    cleanup?.();
  }

  auth(
    options: TelegramLoginOptions,
    callback: (result: TelegramLoginResult) => void,
  ): void {
    this.close();
    // Telegram's browser SDK currently omits origin from this request,
    // producing "origin required" even with a valid client/redirect URI.
    // Keep its post_message flow and explicitly send the current site origin.
    const url = new URL("/auth", TELEGRAM_ORIGIN);
    url.search = new URLSearchParams({
      response_type: "post_message",
      client_id: String(options.client_id),
      origin: window.location.origin,
      redirect_uri: window.location.origin + window.location.pathname,
      scope: ["openid", ...options.scope].join(" "),
      nonce: options.nonce,
      lang: options.lang,
    }).toString();
    // Open inside the click handler, without awaiting a request, so mobile
    // browsers retain the user activation required to allow the popup.
    const popup = window.open(
      url.href,
      "chillpong_telegram_link",
      "popup=yes,width=550,height=650",
    );
    if (!popup) throw new Error("Telegram popup was blocked");

    let pending = true;
    let timer: number | undefined;
    const finish = (result: TelegramLoginResult) => {
      if (!pending) return;
      this.close();
      callback(result);
    };
    const onMessage = (event: MessageEvent) => {
      // Both checks are required: another Telegram tab or an arbitrary
      // window must not be able to complete this popup's link request.
      if (event.origin !== TELEGRAM_ORIGIN || event.source !== popup) return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const result = data as Record<string, unknown>;
      if (result.event !== "auth_result") return;
      if (typeof result.error === "string" && result.error) {
        finish({ error: result.error });
      } else if (typeof result.result === "string" && result.result) {
        // Only the signed token goes to the canister; all claims, including
        // the server nonce and client ID, are verified there as before.
        finish({ id_token: result.result });
      } else {
        finish({ error: "missing_id_token" });
      }
    };
    this.dispose = () => {
      pending = false;
      window.clearInterval(timer);
      window.removeEventListener("message", onMessage);
      try {
        popup.close();
      } catch {
        // The browser may prevent closing a window; its listener is removed.
      }
    };
    window.addEventListener("message", onMessage);
    timer = window.setInterval(() => {
      if (popup.closed) finish({ error: "popup_closed" });
    }, 200);
    try {
      popup.focus();
    } catch {
      // Authorization can still finish if the browser refuses window focus.
    }
  }
}

export class TelegramLoginService {
  private loading: Promise<TelegramLoginSdk> | undefined;
  private browserLogin: TelegramLoginSdk | undefined;

  load(): Promise<TelegramLoginSdk> {
    if (typeof window.TelegramWebviewProxy?.postEvent !== "function") {
      this.browserLogin ??= new BrowserTelegramLogin();
      return Promise.resolve(this.browserLogin);
    }
    // Preserve Telegram's native in-app handoff. Its SDK already includes origin
    // for that route, and the Telegram client supplies the native event bridge.
    if (window.Telegram?.Login) return Promise.resolve(window.Telegram.Login);
    if (this.loading) return this.loading;
    this.loading = new Promise<TelegramLoginSdk>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      const timeout = window.setTimeout(() => fail(), 15_000);
      const fail = () => {
        window.clearTimeout(timeout);
        script.remove();
        this.loading = undefined;
        reject(
          new Error(
            "Couldn't load Telegram. Check your connection and try again.",
          ),
        );
      };
      script.onerror = fail;
      script.onload = () => {
        window.clearTimeout(timeout);
        if (window.Telegram?.Login) resolve(window.Telegram.Login);
        else fail();
      };
      document.head.appendChild(script);
    });
    return this.loading;
  }
}

export const telegramLoginService = new TelegramLoginService();
