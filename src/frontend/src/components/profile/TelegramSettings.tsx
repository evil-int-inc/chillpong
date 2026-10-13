import type { Backend } from "@/backend";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { translateError, useI18n } from "@/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Send } from "lucide-react";
import { useEffect, useState } from "react";

export function TelegramSettings({ actor }: { actor: Backend }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const config = useQuery({
    queryKey: ["telegramConfig"],
    queryFn: () => actor.getTelegramLinkConfig(),
  });
  useEffect(
    () => setClientId(config.data?.clientId ?? ""),
    [config.data?.clientId],
  );
  const save = useMutation({
    mutationFn: (id: string | null) => actor.setTelegramLinkConfig(id),
    onSuccess: (_, id) => {
      client.setQueryData(["telegramConfig"], { clientId: id ?? undefined });
      void client.invalidateQueries({ queryKey: ["telegramChallenge"] });
      setClientId(id ?? "");
    },
  });
  return (
    <section
      className="space-y-4 border border-base-300 bg-base-200/30 p-4 sm:p-6"
      aria-labelledby="telegram-settings-title"
    >
      <h2
        id="telegram-settings-title"
        className="technical-label flex items-center gap-2"
      >
        <Send className="size-4 text-primary" aria-hidden="true" />
        {t("Telegram linking settings")}
      </h2>
      <p className="text-xs leading-relaxed text-base-content/55">
        {t(
          "Use the public Login Client ID from BotFather. Leave blank to disable linking. Bot tokens and client secrets are not needed here.",
        )}
      </p>
      {config.isError ? (
        <div className="space-y-2 text-sm text-error">
          <p>{t("Couldn't load Telegram settings.")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void config.refetch()}
          >
            {t("Try again")}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = clientId.trim();
            setValidation(null);
            if (
              value &&
              (!/^[1-9]\d*$/.test(value) ||
                !Number.isSafeInteger(Number(value)))
            ) {
              setValidation("Enter a valid numeric Telegram Login Client ID.");
              return;
            }
            save.mutate(value || null);
          }}
        >
          <Input
            label={t("Telegram Login Client ID")}
            value={clientId}
            inputMode="numeric"
            autoComplete="off"
            disabled={config.isPending || save.isPending}
            onChange={(event) => {
              setClientId(event.target.value);
              setValidation(null);
              save.reset();
            }}
          />
          {validation || save.error ? (
            <p role="alert" className="text-sm text-error">
              {validation
                ? t(validation)
                : save.error instanceof Error
                  ? translateError(save.error.message)
                  : t("Couldn't save Telegram settings.")}
            </p>
          ) : null}
          {save.isSuccess ? (
            <output className="flex items-center gap-2 text-sm text-primary">
              <Check className="size-4" aria-hidden="true" />
              {t("Telegram settings saved.")}
            </output>
          ) : null}
          <Button
            size="sm"
            type="submit"
            variant="outline"
            loading={save.isPending}
            disabled={
              config.isPending ||
              clientId.trim() === (config.data?.clientId ?? "")
            }
          >
            {t("Save Telegram settings")}
          </Button>
        </form>
      )}
    </section>
  );
}
