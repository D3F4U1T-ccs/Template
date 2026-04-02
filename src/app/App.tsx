import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppDataProvider } from "@/app/providers/app-data-provider";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AppShell } from "@/components/layout/app-shell";
import { CardSurface } from "@/components/ui/primitives";
import { navItems } from "@/data/app-config";
import { useAppData } from "@/hooks/use-app-data";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/app/providers/use-language";
import { useTheme } from "@/app/providers/use-theme";
import { useI18n } from "@/data/i18n";
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const LinksPage = lazy(() => import("@/pages/links-page"));
const TasksPage = lazy(() => import("@/pages/tasks-page"));
const ListsPage = lazy(() => import("@/pages/lists-page"));
const NotesPage = lazy(() => import("@/pages/notes-page"));
const FavoritesPage = lazy(() => import("@/pages/favorites-page"));
const ArchivePage = lazy(() => import("@/pages/archive-page"));

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-[var(--app-bg)] p-5">
      <div className="mx-auto flex h-[calc(100vh-2.5rem)] max-w-[1800px] flex-col gap-5">
        <div className="ml-auto h-14 w-[min(560px,100%)] animate-pulse rounded-full border border-[var(--app-border)] bg-[var(--app-sidebar)]/80 shadow-[var(--shadow-soft)]" />
        <CardSurface className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[var(--canvas-shell)] p-8">
          <div className="space-y-3">
            <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--app-panel-soft)]" />
            <div className="h-5 w-56 animate-pulse rounded-full bg-[var(--app-panel-soft)]" />
            <p className="text-sm text-[var(--app-muted)]">{label}</p>
          </div>
          <div className="mt-8 grid flex-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                className="animate-pulse rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel-strong)]/70 p-5"
                key={index}
              >
                <div className="h-4 w-24 rounded-full bg-[var(--app-panel-soft)]" />
                <div className="mt-6 h-28 rounded-[22px] bg-[var(--app-panel-soft)]" />
                <div className="mt-6 h-3 w-32 rounded-full bg-[var(--app-panel-soft)]" />
                <div className="mt-3 h-3 w-20 rounded-full bg-[var(--app-panel-soft)]" />
              </div>
            ))}
          </div>
        </CardSurface>
      </div>
    </div>
  );
}

function WorkspaceRoutes() {
  const { settings, loading, error } = useAppData();
  const { setTheme } = useTheme();
  const { setLanguage } = useLanguage();
  const { t } = useI18n();
  const defaultPage = navItems.some((item) => item.key === settings.defaultPage)
    ? settings.defaultPage
    : "dashboard";

  useEffect(() => {
    setTheme(settings.theme);
    setLanguage(settings.language);
  }, [setLanguage, setTheme, settings.language, settings.theme]);

  if (loading) {
    return <LoadingScreen label={t("loadingWorkspace")} />;
  }

  return (
    <AppShell>
      {error ? (
        <CardSurface className="mb-6 border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </CardSurface>
      ) : null}
      <Suspense fallback={<LoadingScreen label={t("openingSection")} />}>
        <Routes>
          <Route path="/" element={<Navigate replace to={`/${defaultPage}`} />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/links" element={<LinksPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:listId" element={<ListsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:noteId" element={<NotesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="*" element={<Navigate replace to={`/${defaultPage}`} />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function AuthGate() {
  const { ready, user } = useAuth();
  const { t } = useI18n();

  if (!ready) {
    return <LoadingScreen label={t("initializingAuth")} />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <AppDataProvider>
      <WorkspaceRoutes />
    </AppDataProvider>
  );
}

export default function App() {
  return <AuthGate />;
}
