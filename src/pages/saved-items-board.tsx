import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { ObjectTileCard } from "@/components/ui/object-tile-card";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
import { EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/data/i18n";
import { useAppData } from "@/hooks/use-app-data";
import { useSpaceViewport } from "@/hooks/use-space-viewport";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { CollectionMap, WorkspaceSpaceKey } from "@/types/models";
import {
  getSpacePlacement,
  setSpacePlacement,
  toggleFavorite,
} from "@/utils/entity";
import { normalizeUrl } from "@/utils/files";
import { createGridPlacement } from "@/utils/space";

type SavedMode = "favorites";

type SavedItem = {
  id: string;
  title: string;
  subtitle: string;
  avatarUrl?: string;
  avatarLabel: string;
  collectionName:
    | "links"
    | "linkGroups"
    | "taskGroups"
    | "tasks"
    | "lists"
    | "listItems"
    | "noteGroups"
    | "notes";
  entity:
    | CollectionMap["links"]
    | CollectionMap["linkGroups"]
    | CollectionMap["taskGroups"]
    | CollectionMap["tasks"]
    | CollectionMap["lists"]
    | CollectionMap["listItems"]
    | CollectionMap["noteGroups"]
    | CollectionMap["notes"];
  action:
    | {
        type: "route";
        href: string;
      }
    | {
        type: "external";
        href: string;
      };
};

const FAVORITES_SPACE: WorkspaceSpaceKey = "favorites-board";

function openSavedItem(item: SavedItem, navigate: ReturnType<typeof useNavigate>) {
  if (item.action.type === "external") {
    window.open(normalizeUrl(item.action.href), "_blank", "noopener,noreferrer");
    return;
  }

  navigate(item.action.href);
}

function buildSavedItems(
  collections: ReturnType<typeof useAppData>["collections"],
  t: ReturnType<typeof useI18n>["t"]
) {
  const matches = <T extends { favorite: boolean; archivedAt: string | null; deletedAt: string | null }>(
    item: T
  ) =>
    !item.deletedAt && !item.archivedAt && item.favorite;

  return [
    ...collections.links.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.statusText || item.description || item.url,
      avatarUrl: item.customIconUrl || item.iconUrl,
      avatarLabel: "L",
      collectionName: "links" as const,
      entity: item,
      action: {
        type: "external" as const,
        href: item.url,
      },
    })),
    ...collections.linkGroups.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || t("links"),
      avatarLabel: "G",
      collectionName: "linkGroups" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: "/links",
      },
    })),
    ...collections.tasks.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || item.priority,
      avatarLabel: "T",
      collectionName: "tasks" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: "/tasks",
      },
    })),
    ...collections.taskGroups.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || t("tasks"),
      avatarLabel: "G",
      collectionName: "taskGroups" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: "/tasks",
      },
    })),
    ...collections.lists.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || item.listType,
      avatarUrl: item.coverUrl || undefined,
      avatarLabel: "S",
      collectionName: "lists" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: `/lists/${item.id}`,
      },
    })),
    ...collections.listItems.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || item.itemNotes || t("lists"),
      avatarUrl: item.imageUrl || undefined,
      avatarLabel: "I",
      collectionName: "listItems" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: item.listId ? `/lists/${item.listId}` : "/lists",
      },
    })),
    ...collections.notes.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || t("notes"),
      avatarLabel: "N",
      collectionName: "notes" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: `/notes/${item.id}`,
      },
    })),
    ...collections.noteGroups.filter(matches).map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.description || t("notes"),
      avatarLabel: "G",
      collectionName: "noteGroups" as const,
      entity: item,
      action: {
        type: "route" as const,
        href: "/notes",
      },
    })),
  ] satisfies SavedItem[];
}

export function SavedItemsBoard({ mode: _mode }: { mode: SavedMode }) {
  const navigate = useNavigate();
  const { collections, hardDelete, saveItem } = useAppData();
  const { t } = useI18n();
  const space = FAVORITES_SPACE;
  const { viewport, setViewport } = useSpaceViewport(space);

  const items = useMemo(() => buildSavedItems(collections, t), [collections, t]);

  const nodes = useMemo<Array<SpaceCanvasNode<SavedItem>>>(
    () =>
      items.map((item, index) => ({
        id: item.id,
        data: item,
        placement: getSpacePlacement(
          item.entity,
          space,
          createGridPlacement(index, {
            startX: 96,
            startY: 96,
            width: 228,
            height: 228,
            columns: 6,
          })
        ),
      })),
    [items, space]
  );

  return (
    <SpaceCanvas
      className="h-full min-h-0 rounded-none border-0 shadow-none"
      emptyState={
        <EmptyState
          description={t("favoritesEmpty")}
          title=""
        />
      }
      nodes={nodes}
      onNodeClick={(node) => openSavedItem(node.data, navigate)}
      onPlacementCommit={(id, placement) => {
        const match = items.find((item) => item.id === id);

        if (!match) {
          return;
        }

        void saveItem(
          match.collectionName,
          setSpacePlacement(match.entity, space, placement) as never
        );
      }}
      onViewportChange={setViewport}
      renderNode={(node) => {
        const item = node.data;

        return (
          <ObjectTileCard
            avatarLabel={item.avatarLabel}
            avatarUrl={item.avatarUrl}
            className="cursor-grab active:cursor-grabbing"
            cornerRadius={item.entity.cornerRadius}
            menu={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-space-no-drag="true"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openSavedItem(item, navigate)}>
                    {t("open")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(item.collectionName, toggleFavorite(item.entity) as never)
                    }
                  >
                    {t("removeFavorite")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void hardDelete(item.collectionName, item.entity.id)}
                  >
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            subtitle={item.subtitle}
            title={item.title}
          />
        );
      }}
      size={{ width: 3600, height: 2400 }}
      viewport={viewport}
    />
  );
}
