import {
  type Backend,
  type ProfileInput,
  type User,
  createActor,
} from "@/backend";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { translateError, useI18n } from "@/i18n";
import { authService } from "@/services/auth";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Save, UserRound } from "lucide-react";
import { useState } from "react";

function ProfileEditor({
  actor,
  principal,
  profile,
}: {
  actor: Backend;
  principal: string;
  profile: User | null;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const keepsExistingUsername =
    !!profile && username.trim() === profile.username.trim();

  const saveMutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      authService.saveCallerProfile(actor, input),
    onSuccess: (saved) => {
      queryClient.setQueryData(["profile", principal], saved);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setName(saved.displayName);
      setUsername(saved.username);
    },
  });

  function saveProfile() {
    setFormError(null);
    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedName.length > 80) {
      setFormError("Keep your name to 80 characters or fewer.");
      return;
    }
    if (
      trimmedUsername &&
      !keepsExistingUsername &&
      !/^[a-z0-9_-]{3,30}$/.test(trimmedUsername)
    ) {
      setFormError(
        "Username needs 3–30 letters, numbers, underscores or hyphens.",
      );
      return;
    }
    saveMutation.mutate({
      displayName: trimmedName,
      username: keepsExistingUsername ? profile.username : trimmedUsername,
    });
  }

  return (
    <form
      className="space-y-6 border border-base-300 bg-base-200 p-6 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        saveProfile();
      }}
    >
      <div className="flex items-center gap-3 border-b border-base-300 pb-5">
        <UserRound className="size-5 text-primary" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold uppercase">
          {t("Your club identity")}
        </h2>
      </div>
      <Input
        label={t("Name / optional")}
        autoComplete="name"
        maxLength={80}
        placeholder={t("Name at the table")}
        value={name}
        disabled={saveMutation.isPending}
        hint={t("Leave blank if you prefer. Up to 80 characters.")}
        onChange={(event) => {
          setName(event.target.value);
          setFormError(null);
          saveMutation.reset();
        }}
      />
      <Input
        label={t("Username / optional")}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        className="font-mono"
        maxLength={keepsExistingUsername ? undefined : 30}
        placeholder={t("your-handle")}
        value={username}
        disabled={saveMutation.isPending}
        hint={
          keepsExistingUsername && username
            ? t("Keep this username, choose another one, or leave it blank.")
            : t(
                "Optional. If provided, use 3–30 letters, numbers, underscores or hyphens. Saved in lowercase.",
              )
        }
        onChange={(event) => {
          setUsername(event.target.value);
          setFormError(null);
          saveMutation.reset();
        }}
      />
      {formError || saveMutation.isError ? (
        <p
          role="alert"
          className="border border-error/40 p-4 text-sm text-error"
        >
          {t(formError) ||
            (saveMutation.error instanceof Error
              ? translateError(saveMutation.error.message)
              : t("Couldn't save your profile. Try again."))}
        </p>
      ) : null}
      {saveMutation.isSuccess ? (
        <output
          className="flex items-center gap-2 text-sm text-primary"
          aria-live="polite"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("Profile saved.")}
        </output>
      ) : null}
      <div className="flex justify-end border-t border-base-300 pt-5">
        <Button type="submit" loading={saveMutation.isPending}>
          <Save className="size-4" aria-hidden="true" />
          {t("Save profile")}
        </Button>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { t } = useI18n();
  const { actor, isFetching } = useActor(createActor);
  const { principal, isAuthenticated } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["profile", principal],
    queryFn: () => {
      if (!actor) throw new Error("Your account is still connecting.");
      return authService.getCallerProfile(actor);
    },
    enabled: !!actor && !isFetching && isAuthenticated,
  });

  if (!isAuthenticated || !principal) return null;

  return (
    <div data-ocid="profile_page" className="club-page">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="section-kicker mb-4">{t("CHILLPONG / MEMBER FILE")}</p>
          <h1 className="page-title">
            {t("YOUR")} <span className="text-primary">{t("PROFILE.")}</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t(
              "A name for the club. A handle for the crew. Both are optional.",
            )}
          </p>
        </header>
        <div className="space-y-2 border-l-2 border-primary pl-4">
          <p className="technical-label">
            {t("Your member ID / Principal ID")}
          </p>
          <code className="block select-all break-all font-mono text-xs leading-relaxed">
            {principal}
          </code>
        </div>
        {profileQuery.isError ? (
          <ErrorState
            title={t("Couldn't load your profile")}
            message={t(
              "Your details are unavailable. Try again before editing.",
            )}
            onRetry={() => void profileQuery.refetch()}
          />
        ) : profileQuery.isPending || isFetching || !actor ? (
          <output className="flex items-center justify-center gap-3 border border-base-300 p-12 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {t("Loading your profile")}
          </output>
        ) : (
          <ProfileEditor
            key={principal}
            actor={actor}
            principal={principal}
            profile={profileQuery.data ?? null}
          />
        )}
      </div>
    </div>
  );
}
