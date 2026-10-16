import type { Backend, User } from "@/backend";
import { Button } from "@/components/ui/Button";
import { translateError, useI18n } from "@/i18n";
import { telegramLoginService } from "@/services/telegram-login.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, RefreshCw, Send, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function TelegramLink({
  actor,
  principal,
}: { actor: Backend; principal: string }) {
  const { t, language } = useI18n();
  const client = useQueryClient();
  const active = useRef(true);
  const [waiting, setWaiting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const attempt = useRef(0);
  const config = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: () => actor.getTelegramLinkConfig(),
    staleTime: 60_000,
  });
  const link = useQuery({
    queryKey: ["telegramLink", principal],
    queryFn: () => actor.getCallerTelegramLink(),
  });
  const sdk = useQuery({
    queryKey: ["telegramSdk"],
    queryFn: () => telegramLoginService.load(),
    enabled: !!config.data?.clientId,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current += 1;
      clearTimeout(waitingTimer.current);
      sdk.data?.close();
    };
  }, [sdk.data]);

  async function saved(profile: User, message: string) {
    // Closing the popup can refocus the app and start reads of the old state.
    // Cancel those reads before publishing the verified mutation result so a
    // delayed response cannot restore the previous username or link status.
    await Promise.all([
      client.cancelQueries({ queryKey: ["profile", principal], exact: true }),
      client.cancelQueries({
        queryKey: ["telegramLink", principal],
        exact: true,
      }),
    ]);
    client.setQueryData(["profile", principal], profile);
    void client.invalidateQueries({ queryKey: ["users"] });
    void client.invalidateQueries({ queryKey: ["adminUsers"] });
    void client.invalidateQueries({ queryKey: ["players"] });
    void client.invalidateQueries({ queryKey: ["tournamentState"] });
    void client.invalidateQueries({ queryKey: ["telegramLink", principal] });
    setSuccess(message);
  }
  const verify = useMutation({
    mutationFn: (token: string) => actor.completeTelegramLink(token),
    onSuccess: async (profile) => {
      await saved(
        profile,
        "Telegram linked. Your username now matches Telegram.",
      );
      void challenge.refetch();
    },
  });
  const unlink = useMutation({
    mutationFn: () => actor.unlinkTelegram(),
    onSuccess: async (profile) => {
      await saved(profile, "Telegram unlinked. Your username is unchanged.");
      void challenge.refetch();
    },
  });
  const pending = waiting || verify.isPending || unlink.isPending;
  // Prepare the server challenge before the click so the SDK can open its popup
  // synchronously inside the browser's user activation (including mobile Safari).
  // Keep it unchanged while the popup or server verification is in progress.
  const challenge = useQuery({
    queryKey: ["telegramChallenge", principal, config.data?.clientId],
    queryFn: () => actor.startTelegramLink(),
    enabled: !!config.data?.clientId && !!sdk.data,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: pending ? false : 120_000,
    retry: false,
  });
  const ready =
    !!sdk.data &&
    !!challenge.data &&
    !challenge.isFetching &&
    !link.isPending &&
    !pending;
  const failure =
    loginError ??
    (verify.error instanceof Error ? verify.error.message : null) ??
    (unlink.error instanceof Error ? unlink.error.message : null);
  const preparationError =
    config.isError || link.isError || sdk.isError || challenge.isError;

  function start() {
    if (!ready || !sdk.data || !challenge.data) return;
    if (Number(challenge.data.expiresAt / 1_000_000n) <= Date.now()) {
      setLoginError(
        "The Telegram link request expired. Refresh it and try again.",
      );
      void challenge.refetch();
      return;
    }
    setLoginError(null);
    setSuccess(null);
    verify.reset();
    unlink.reset();
    setWaiting(true);
    const currentAttempt = ++attempt.current;
    waitingTimer.current = setTimeout(() => {
      if (!active.current) return;
      attempt.current += 1;
      setWaiting(false);
      setLoginError(
        "Telegram didn't finish linking. Allow popups or retry in your browser.",
      );
      sdk.data?.close();
    }, 120_000);
    try {
      sdk.data.auth(
        {
          client_id: Number(challenge.data.clientId),
          nonce: challenge.data.nonce,
          scope: ["profile"],
          lang: language,
        },
        (result) => {
          if (!active.current || attempt.current !== currentAttempt) return;
          clearTimeout(waitingTimer.current);
          setWaiting(false);
          if (result.error || !result.id_token) {
            setLoginError(
              result.error === "legacy_login"
                ? "This bot is using legacy Telegram login. Enable the new Login Widget in BotFather and register this site's URLs."
                : "Telegram linking was cancelled or could not be completed. Try again.",
            );
            return;
          }
          // The canister verifies the signed token. Decoded SDK user fields are
          // never used to choose a member, Telegram account, or username.
          verify.mutate(result.id_token);
        },
      );
    } catch {
      clearTimeout(waitingTimer.current);
      setWaiting(false);
      setLoginError(
        "Telegram didn't finish linking. Allow popups or retry in your browser.",
      );
    }
  }

  return (
    <section
      className="space-y-4 border border-base-300 bg-base-200 p-6 sm:p-8"
      aria-labelledby="telegram-link-title"
    >
      <header className="flex items-center gap-3 border-b border-base-300 pb-4">
        <Send className="size-5 text-primary" aria-hidden="true" />
        <h2
          id="telegram-link-title"
          className="font-display text-xl font-semibold uppercase"
        >
          {t("Telegram")}
        </h2>
      </header>
      <p className="text-sm leading-relaxed text-base-content/60">
        {t(
          "Link Telegram to your existing member account. Linking replaces your current username with your Telegram username.",
        )}
      </p>
      {link.data ? (
        <p className="font-mono text-sm text-primary">
          {t("Linked Telegram account")} / @{link.data.username}
        </p>
      ) : null}
      {config.isSuccess && !config.data.clientId ? (
        <p className="text-sm text-base-content/55">
          {t(
            "Telegram linking is not configured yet. Ask an admin to set the public Login Client ID.",
          )}
        </p>
      ) : null}
      {preparationError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-error">
          <p>{t("Couldn't prepare Telegram linking. Try again.")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void config.refetch();
              void link.refetch();
              if (config.data?.clientId) {
                void sdk.refetch();
                void challenge.refetch();
              }
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("Try again")}
          </Button>
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-error">
          {translateError(failure)}
        </p>
      ) : null}
      {success ? (
        <output className="flex items-center gap-2 text-sm text-primary">
          <Check className="size-4" aria-hidden="true" />
          {t(success)}
        </output>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          loading={pending}
          disabled={!ready || preparationError}
          onClick={start}
        >
          <Link2 className="size-4" aria-hidden="true" />
          {link.data ? t("Sync Telegram profile") : t("Link Telegram")}
        </Button>
        {waiting ? (
          <Button
            variant="ghost"
            onClick={() => {
              attempt.current += 1;
              clearTimeout(waitingTimer.current);
              sdk.data?.close();
              setWaiting(false);
            }}
          >
            {t("Cancel")}
          </Button>
        ) : link.data ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setSuccess(null);
              setLoginError(null);
              unlink.mutate();
            }}
          >
            <Unlink className="size-4" aria-hidden="true" />
            {t("Unlink Telegram")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
