import { Database, Lock, Sparkles } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/data/i18n";
import { Button } from "@/shared/ui/button";
import { CardSurface } from "@/components/ui/primitives";

export function AuthScreen() {
  const {
    signInWithGoogle,
    continueInLocalMode,
    isFirebaseConfigured,
    missingFirebaseEnv,
  } = useAuth();
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setSubmitting(true);

    try {
      await signInWithGoogle();
      pushToast({
        title: t("authConfigured"),
        description: t("signInGoogle"),
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: t("firebaseIssueTitle"),
        description:
          error instanceof Error ? error.message : "Google sign-in failed.",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] px-4 py-10 text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--canvas-spotlight),transparent_32%),radial-gradient(circle_at_bottom_right,var(--app-brand-soft),transparent_28%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--app-muted)]">
            {t("authConfigured")}
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[var(--app-text)]">
            {t("authTitle")}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--app-muted)]">
            {t("authSubtitle")}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Lock,
                title: t("authFeatureAuth"),
                text: t("authFeatureAuthText"),
              },
              {
                icon: Database,
                title: t("authFeatureSync"),
                text: t("authFeatureSyncText"),
              },
              {
                icon: Sparkles,
                title: t("authFeatureMinimal"),
                text: t("authFeatureMinimalText"),
              },
            ].map((item) => (
              <CardSurface className="bg-[var(--app-panel)] p-5" key={item.title}>
                <item.icon className="h-5 w-5 text-[var(--app-brand)]" />
                <p className="mt-4 font-semibold text-[var(--app-text)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{item.text}</p>
              </CardSurface>
            ))}
          </div>
        </div>

        <CardSurface className="bg-[var(--app-bg-elevated)] p-6 lg:p-8">
          {isFirebaseConfigured ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-5">
                <p className="font-semibold text-[var(--app-text)]">{t("authConfigured")}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                  {t("authSubtitle")}
                </p>
              </div>
              <Button
                className="h-12 w-full rounded-2xl"
                disabled={submitting}
                onClick={() => void handleGoogleSignIn()}
              >
                {submitting ? "..." : t("signInGoogle")}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
                <p className="font-semibold text-amber-700 dark:text-amber-100">
                  {t("authLocalWarning")}
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-700/80 dark:text-amber-100/80">
                  {t("missingEnv")}: {missingFirebaseEnv.join(", ")}
                </p>
              </div>
              <Button className="h-11 w-full" onClick={continueInLocalMode} variant="secondary">
                {t("continueLocal")}
              </Button>
            </div>
          )}
        </CardSurface>
      </div>
    </div>
  );
}
