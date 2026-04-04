import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Rows3, StarOff, Trash2 } from "lucide-react";

import { BoardTextCard } from "@/components/ui/board-text-card";
import { ObjectTileCard } from "@/components/ui/object-tile-card";
import { SpaceListMode } from "@/components/ui/space-list-mode";
import {
  SpaceSidePanel,
  type SpaceSidePanelItem,
} from "@/components/ui/space-side-panel";
import {
  SpaceObjectFinder,
  type SpaceObjectFinderItem,
} from "@/components/ui/space-object-finder";
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
  toggleArchive,
  toggleFavorite,
  togglePinned,
} from "@/utils/entity";
import { normalizeUrl, resolveLinkIconUrl } from "@/utils/files";
import { createGridPlacement, createViewportCenteredOnPlacement } from "@/utils/space";
import {
  ensureShortcutBoardPlacements,
  getBoardTextPlacementSize,
  getFontSizeFromResize,
} from "@/utils/board";

type SavedMode = "favorites";

type SavedTileItem = {
  id: string;
  kind: "tile";
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

type SavedTextItem = {
  id: string;
  kind: "text";
  title: string;
  subtitle: string;
  avatarLabel: string;
  collectionName: "boardTexts";
  entity: CollectionMap["boardTexts"];
  action: null;
};

type SavedItem = SavedTileItem | SavedTextItem;

const FAVORITES_SPACE: WorkspaceSpaceKey = "favorites-board";

function openSavedItem(item: SavedTileItem, navigate: ReturnType<typeof useNavigate>) {
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
    ...collections.boardTexts
      .filter(
        (item) =>
          matches(item) &&
          !!item.spacePlacements?.[FAVORITES_SPACE]
      )
      .map((item) => ({
        id: item.id,
        kind: "text" as const,
        title: item.content.split("\n")[0] || t("createText"),
        subtitle: t("favoritesPage"),
        avatarLabel: "T",
        collectionName: "boardTexts" as const,
        entity: item,
        action: null,
      })),
    ...collections.links.filter(matches).map((item) => ({
      id: item.id,
      kind: "tile" as const,
      title: item.title,
      subtitle: item.statusText || item.description || item.url,
      avatarUrl: resolveLinkIconUrl({
        url: item.url,
        customIconUrl: item.customIconUrl,
        iconUrl: item.iconUrl,
      }),
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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
      kind: "tile" as const,
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

export function SavedItemsBoard({ mode }: { mode: SavedMode }) {
  const navigate = useNavigate();
  const { collections, hardDelete, saveItem, settings } = useAppData();
  const { t } = useI18n();
  const space = FAVORITES_SPACE;
  void mode;
  const { viewport, setViewport } = useSpaceViewport(space);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);

  const items = useMemo(() => buildSavedItems(collections, t), [collections, t]);

  const nodes = useMemo<Array<SpaceCanvasNode<SavedItem>>>(
    () =>
      items.map((item, index) => {
        const itemSize =
          item.kind === "text"
            ? getBoardTextPlacementSize(item.entity)
            : { width: 228, height: 228 };
        const basePlacement = getSpacePlacement(
          item.entity,
          space,
          createGridPlacement(index, {
            startX: 96,
            startY: 96,
            width: itemSize.width,
            height: itemSize.height,
            columns: 6,
          })
        );

        return {
          id: item.id,
          data: item,
          placement:
            item.kind === "text"
              ? {
                  ...basePlacement,
                  width: itemSize.width,
                  height: itemSize.height,
                }
              : basePlacement,
          ...(item.kind === "text"
            ? {
                resizable: true,
                resizeMode: "font-size" as const,
                minSize: {
                  width: 220,
                  height: 120,
                },
                zIndex: 60,
              }
            : {}),
        };
      }),
    [items, space]
  );

  const finderItems = useMemo<Array<SpaceObjectFinderItem>>(
    () =>
      nodes.map((node) => {
        if (node.data.kind === "text") {
          return {
            id: node.id,
            title:
              node.data.entity.content
                .split("\n")
                .map((line) => line.trim())
                .find(Boolean) || t("createText"),
            subtitle: t("favoritesPage"),
            kindLabel: t("objectTypeText"),
            placement: node.placement,
          };
        }

        const kindLabelMap = {
          links: t("objectTypeLink"),
          linkGroups: t("objectTypeGroup"),
          taskGroups: t("objectTypeGroup"),
          tasks: t("objectTypeTask"),
          lists: t("objectTypeList"),
          listItems: t("objectTypeItem"),
          noteGroups: t("objectTypeGroup"),
          notes: t("objectTypeNote"),
        } as const;

        return {
          id: node.id,
          title: node.data.title,
          subtitle: node.data.subtitle,
          kindLabel: kindLabelMap[node.data.collectionName],
          placement: node.placement,
        };
      }),
    [nodes, t]
  );

  const sidePanelItems = useMemo<Array<SpaceSidePanelItem>>(
    () =>
      items
        .filter((item) => item.kind === "tile")
        .map((item) => ({
          id: `favorite-${item.id}`,
          title: item.title,
          subtitle: item.subtitle,
          kind: "item" as const,
          previewImageUrl: "avatarUrl" in item ? item.avatarUrl : undefined,
          previewLabel: item.avatarLabel,
          onClick: () => {
            if (item.kind === "tile") {
              openSavedItem(item, navigate);
            }
          },
          actions: [
            {
              id: `unfavorite-${item.id}`,
              icon: <StarOff className="h-4 w-4" />,
              label: t("removeFavorite"),
              onClick: () => {
                if (item.kind === "tile") {
                  void saveItem(item.collectionName, toggleFavorite(item.entity) as never);
                }
              },
            },
            {
              id: `delete-${item.id}`,
              icon: <Trash2 className="h-4 w-4" />,
              label: t("delete"),
              onClick: () => {
                if (item.kind === "tile") {
                  void hardDelete(item.collectionName, item.entity.id);
                }
              },
              tone: "danger" as const,
            },
          ],
        })),
    [hardDelete, items, navigate, saveItem, t]
  );

  return (
    <div className="relative h-full">
      {!listMode ? (
        <SpaceSidePanel
          items={sidePanelItems}
          title={t("favoritesPage")}
        />
      ) : null}

      {listMode ? (
        <SpaceListMode
          items={sidePanelItems}
          onExit={() => setListMode(false)}
          title={t("favoritesPage")}
        />
      ) : (
        <SpaceCanvas
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        emptyState={
          <EmptyState
            description={t("favoritesEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "text") {
            return;
          }

          setSelectedTextId(null);
          openSavedItem(node.data, navigate);
        }}
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
        onFontResizeCommit={({ id, origin, preview }) => {
          const match = items.find((item) => item.id === id && item.kind === "text");

          if (!match || match.kind !== "text") {
            return;
          }

          setSelectedTextId(match.id);
          void saveItem("boardTexts", {
            ...match.entity,
            fontSize: getFontSizeFromResize({
              currentFontSize: match.entity.fontSize,
              origin,
              preview,
              max: 160,
            }),
          });
        }}
        onViewportChange={setViewport}
        renderNode={(node, options) => {
          const item = node.data;

          if (item.kind === "text") {
            return (
              <BoardTextCard
                active={selectedTextId === item.id}
                className="cursor-grab active:cursor-grabbing"
                item={item.entity}
                onActivate={() => setSelectedTextId(item.id)}
                onArchive={() => void saveItem("boardTexts", toggleArchive(item.entity))}
                onDeactivate={() =>
                  setSelectedTextId((current) => (current === item.id ? null : current))
                }
                onDelete={() => void hardDelete("boardTexts", item.entity.id)}
                onSave={(patch) =>
                  void saveItem("boardTexts", {
                    ...item.entity,
                    ...patch,
                  })
                }
                onToggleFavorite={() =>
                  void saveItem(
                    "boardTexts",
                    ensureShortcutBoardPlacements(
                      toggleFavorite(item.entity),
                      settings,
                      getBoardTextPlacementSize(item.entity)
                    )
                  )
                }
                onTogglePin={() =>
                  void saveItem(
                    "boardTexts",
                    ensureShortcutBoardPlacements(
                      togglePinned(item.entity),
                      settings,
                      getBoardTextPlacementSize(item.entity)
                    )
                  )
                }
                previewFontSize={getFontSizeFromResize({
                  currentFontSize: item.entity.fontSize,
                  origin: node.placement,
                  preview: options.previewPlacement,
                  max: 160,
                })}
              />
            );
          }

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
      )}

      <SpaceObjectFinder
        items={finderItems}
        floatingActions={
          <Button
            aria-label={listMode ? t("spaceCanvasLabel") : t("spaceListLabel")}
            className="rounded-full shadow-[var(--shadow-soft)]"
            onClick={() => setListMode((current) => !current)}
            size="icon"
            variant="secondary"
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        }
        onFocusItem={(item) =>
          {
            setListMode(false);
            setViewport(createViewportCenteredOnPlacement(item.placement, viewport));
          }
        }
      />
    </div>
  );
}
