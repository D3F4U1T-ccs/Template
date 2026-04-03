import { useMemo, useState } from "react";
import { Binoculars, Search } from "lucide-react";

import { Modal } from "@/components/ui/modal";
import { EmptyState, SearchField } from "@/components/ui/primitives";
import { useI18n } from "@/data/i18n";
import { Button } from "@/shared/ui/button";
import type { SpacePlacement } from "@/types/models";

export type SpaceObjectFinderItem = {
  id: string;
  title: string;
  subtitle?: string;
  kindLabel?: string;
  placement: SpacePlacement;
};

export function SpaceObjectFinder({
  items,
  onFocusItem,
}: {
  items: SpaceObjectFinderItem[];
  onFocusItem: (item: SpaceObjectFinderItem) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) =>
      `${item.title} ${item.subtitle ?? ""} ${item.kindLabel ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [items, query]);

  function handleOpen() {
    setQuery("");
    setOpen(true);
  }

  function handleFocusItem(item: SpaceObjectFinderItem) {
    onFocusItem(item);
    setOpen(false);
  }

  return (
    <>
      <div className="pointer-events-none absolute bottom-4 right-4 z-20">
        <div className="pointer-events-auto">
          <Button
            aria-label={t("spaceFinderTitle")}
            className="rounded-full shadow-[var(--shadow-soft)]"
            onClick={handleOpen}
            size="icon"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Modal
        description={t("spaceFinderDescription")}
        onClose={() => setOpen(false)}
        open={open}
        size="lg"
        title={t("spaceFinderTitle")}
      >
        <div className="space-y-4">
          <SearchField
            className="max-w-xl"
            onChange={setQuery}
            placeholder={t("spaceFinderPlaceholder")}
            value={query}
          />

          {filteredItems.length ? (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--app-text)]">{item.title}</p>
                    {item.subtitle || item.kindLabel ? (
                      <p className="mt-1 truncate text-sm text-[var(--app-muted)]">
                        {[item.kindLabel, item.subtitle].filter(Boolean).join(" • ")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    className="gap-2 rounded-full"
                    onClick={() => handleFocusItem(item)}
                    size="sm"
                    variant="secondary"
                  >
                    <Binoculars className="h-4 w-4" />
                    {t("spaceFinderGo")}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description={t("spaceFinderEmpty")}
              title=""
            />
          )}
        </div>
      </Modal>
    </>
  );
}
