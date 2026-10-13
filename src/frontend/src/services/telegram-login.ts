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
  }
}

const SDK_URL = "https://oauth.telegram.org/js/telegram-login.js?6";
let loading: Promise<TelegramLoginSdk> | undefined;

export function loadTelegramLogin(): Promise<TelegramLoginSdk> {
  if (window.Telegram?.Login) return Promise.resolve(window.Telegram.Login);
  if (loading) return loading;
  loading = new Promise<TelegramLoginSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 15_000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(
        new Error(
          "Couldn't load Telegram. Check your connection and try again.",
        ),
      );
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.Telegram?.Login) resolve(window.Telegram.Login);
      else fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}
