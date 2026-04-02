import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { ObjectTileCard } from "@/components/ui/object-tile-card";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
import { EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/data/i18n";
import { useAppData } from "@/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { CollectionMap, WorkspaceSpaceKey } from "@/types/models";
import { getSpacePlacement, setSpacePlacement, toggleFavorite, togglePinned } from "@/utils/entity";
import { createGridPlacement } from "@/utils/space";
import { useSpaceViewport } from "@/hooks/use-space-viewport";

type DashboardPinnedItem = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  collectionName:
    | "links"
    | "linkGroups"
    | "taskGroups"
    | "tasks"
    | "notes"
    | "noteGroups"
    | "lists";
  entity:
    | CollectionMap["links"]
    | CollectionMap["linkGroups"]
    | CollectionMap["taskGroups"]
    | CollectionMap["tasks"]
    | CollectionMap["notes"]
    | CollectionMap["noteGroups"]
    | CollectionMap["lists"];
  avatarUrl?: string;
  avatarLabel: string;
};

const DASHBOARD_SPACE: WorkspaceSpaceKey = "dashboard-board";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { collections, saveItem } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(DASHBOARD_SPACE);
  const { t } = useI18n();

  const pinnedItems = useMemo<DashboardPinnedItem[]>(
    () => [
      ...collections.links
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.statusText || item.description || item.url,
          route: "/links",
          collectionName: "links" as const,
          entity: item,
          avatarUrl: item.customIconUrl || item.iconUrl,
          avatarLabel: "L",
        })),
      ...collections.linkGroups
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || t("links"),
          route: "/links",
          collectionName: "linkGroups" as const,
          entity: item,
          avatarLabel: "G",
        })),
      ...collections.taskGroups
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || t("tasks"),
          route: "/tasks",
          collectionName: "taskGroups" as const,
          entity: item,
          avatarLabel: "G",
        })),
      ...collections.tasks
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || item.priority,
          route: "/tasks",
          collectionName: "tasks" as const,
          entity: item,
          avatarLabel: "T",
        })),
      ...collections.lists
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || item.listType,
          route: `/lists/${item.id}`,
          collectionName: "lists" as const,
          entity: item,
          avatarUrl: item.coverUrl || undefined,
          avatarLabel: "S",
        })),
      ...collections.noteGroups
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || t("notes"),
          route: "/notes",
          collectionName: "noteGroups" as const,
          entity: item,
          avatarLabel: "G",
        })),
      ...collections.notes
        .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
        .map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.description || t("notes"),
          route: `/notes/${item.id}`,
          collectionName: "notes" as const,
          entity: item,
          avatarLabel: "N",
        })),
    ],
    [collections, t]
  );

  const nodes = useMemo<Array<SpaceCanvasNode<DashboardPinnedItem>>>(
    () =>
      pinnedItems.map((item, index) => ({
        id: item.id,
        data: item,
        placement: getSpacePlacement(
          item.entity,
          DASHBOARD_SPACE,
          createGridPlacement(index, {
            startX: 96,
            startY: 96,
            width: 228,
            height: 228,
            columns: 6,
          })
        ),
      })),
    [pinnedItems]
  );

  return (
    <SpaceCanvas
      className="h-full min-h-0 rounded-none border-0 shadow-none"
      emptyState={
        <EmptyState
          description={t("dashboardEmpty")}
          title=""
        />
      }
      nodes={nodes}
      onNodeClick={(node) => navigate(node.data.route)}
      onPlacementCommit={(id, placement) => {
        const match = pinnedItems.find((item) => item.id === id);

        if (!match) {
          return;
        }

        void saveItem(
          match.collectionName,
          setSpacePlacement(match.entity, DASHBOARD_SPACE, placement) as never
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
                  <DropdownMenuItem onClick={() => navigate(item.route)}>
                    {t("open")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(item.collectionName, togglePinned(item.entity) as never)
                    }
                  >
                    {t("unpin")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(item.collectionName, toggleFavorite(item.entity) as never)
                    }
                  >
                    {item.entity.favorite ? t("removeFavorite") : t("favorite")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            subtitle={item.subtitle}
            title={item.title}
          />
        );
      }}
      size={{ width: 3400, height: 2200 }}
      viewport={viewport}
    />
  );
}
