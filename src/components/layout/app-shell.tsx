import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "@/components/ui/modal";
import { Badge, SearchField } from "@/components/ui/primitives";
import { useAppData } from "@/hooks/use-app-data";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/data/i18n";
import type { SearchResultItem } from "@/types/models";
import { matchesQuery } from "@/utils/search";
import { formatDateTime } from "@/utils/date";
import { Topbar } from "@/components/layout/topbar";

function buildResults(data: ReturnType<typeof useAppData>["collections"], t: ReturnType<typeof useI18n>["t"]) {
  const results: SearchResultItem[] = [];

  data.links.forEach((item) => {
    if (!item.deletedAt) {
      results.push({
        id: item.id,
        title: item.title,
        subtitle: item.url,
        route: "/links",
        section: t("links"),
        keywords: [item.description, item.statusText, ...(item.tags ?? [])],
      });
    }
  });

  data.tasks.forEach((item) => {
    if (!item.deletedAt) {
      results.push({
        id: item.id,
        title: item.title,
        subtitle: item.dueDate || item.priority,
        route: "/tasks",
        section: t("tasks"),
        keywords: [item.description, item.priority, item.taskType, ...(item.tags ?? [])],
      });
    }
  });

  data.lists.forEach((item) => {
    if (!item.deletedAt) {
      results.push({
        id: item.id,
        title: item.title,
        subtitle: item.listType,
        route: `/lists/${item.id}`,
        section: t("lists"),
        keywords: [item.description, item.listType, ...(item.tags ?? [])],
      });
    }
  });

  data.notes.forEach((item) => {
    if (!item.deletedAt) {
      results.push({
        id: item.id,
        title: item.title,
        subtitle: formatDateTime(item.updatedAt),
        route: `/notes/${item.id}`,
        section: t("notes"),
        keywords: [item.description, item.content, ...(item.tags ?? [])],
      });
    }
  });

  return results;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { collections, mode, syncIssue } = useAppData();
  const { isFirebaseConfigured, missingFirebaseEnv } = useAuth();
  const { t } = useI18n();

  const searchResults = useMemo(() => {
    const items = buildResults(collections, t);

    if (!query.trim()) {
      return items.slice(0, 12);
    }

    return items.filter((item) =>
      matchesQuery(query, [item.title, item.subtitle, item.section, item.keywords])
    );
  }, [collections, query, t]);

  const warningMessage = syncIssue
    ? `${t("firebaseIssueTitle")}: ${syncIssue}`
    : mode === "local"
      ? `${t("localOnlyMessage")}${
          !isFirebaseConfigured && missingFirebaseEnv.length
            ? ` ${t("missingEnv")}: ${missingFirebaseEnv.join(", ")}.`
            : ""
        }`
      : null;

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <Topbar onSearchOpen={() => setSearchOpen(true)} />

      {warningMessage ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-40 max-w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-800 shadow-[var(--shadow-soft)] backdrop-blur dark:text-amber-100">
          {warningMessage}
        </div>
      ) : null}

      <main className="h-full overflow-hidden pt-0">
        <div className="h-full">{children}</div>
      </main>

      <Modal
        onClose={() => {
          setSearchOpen(false);
          setQuery("");
        }}
        open={searchOpen}
        title={t("globalSearch")}
      >
        <div className="space-y-5">
          <SearchField
            onChange={setQuery}
            placeholder={t("searchPlaceholder")}
            value={query}
          />
          <div className="space-y-3">
            {searchResults.length ? (
              searchResults.map((item) => (
                <button
                  className="flex w-full items-start justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                  key={`${item.section}-${item.id}`}
                  onClick={() => {
                    navigate(item.route);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  type="button"
                >
                  <div>
                    <p className="font-medium text-[var(--app-text)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">{item.subtitle}</p>
                  </div>
                  <Badge>{item.section}</Badge>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--app-border)] px-4 py-10 text-center text-sm text-[var(--app-muted)]">
                {t("noSearchResults")}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
