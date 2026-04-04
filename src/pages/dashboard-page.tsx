import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, PencilLine, PinOff, Rows3, Trash2 } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { SpaceListMode } from "@/components/ui/space-list-mode";
import { Modal } from "@/components/ui/modal";
import { ObjectTileCard } from "@/components/ui/object-tile-card";
import {
  SpaceSidePanel,
  type SpaceSidePanelItem,
} from "@/components/ui/space-side-panel";
import {
  SpaceObjectFinder,
  type SpaceObjectFinderItem,
} from "@/components/ui/space-object-finder";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
import { Badge, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
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
import type {
  BoardTextItem,
  CollectionMap,
  DashboardGroup,
  WorkspaceSpaceKey,
} from "@/types/models";
import {
  filterActive,
  nextOrder,
  setDashboardGroupId,
  setSpacePlacement,
  toggleArchive,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_STYLE,
  LINK_GROUP_LAYOUT,
  createContainerPlacement,
  ensureEntityCenteredInSpace,
  getBoardTextPlacementSize,
  getFontSizeFromResize,
  ensureShortcutBoardPlacements,
} from "@/utils/board";
import {
  createGridPlacement,
  createViewportCenteredOnPlacement,
  getInnermostContainingEntry,
} from "@/utils/space";
import { resolveLinkIconUrl } from "@/utils/files";

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
    | "listItems"
    | "notes"
    | "noteGroups"
    | "lists";
  entity:
    | CollectionMap["links"]
    | CollectionMap["linkGroups"]
    | CollectionMap["taskGroups"]
    | CollectionMap["tasks"]
    | CollectionMap["listItems"]
    | CollectionMap["notes"]
    | CollectionMap["noteGroups"]
    | CollectionMap["lists"];
  avatarUrl?: string;
  avatarLabel: string;
};

type DashboardNodeData =
  | {
      kind: "group";
      group: DashboardGroup;
      itemCount: number;
    }
  | {
      kind: "item";
      item: DashboardPinnedItem;
      group: DashboardGroup | null;
    }
  | {
      kind: "text";
      text: BoardTextItem;
    };

const DASHBOARD_SPACE: WorkspaceSpaceKey = "dashboard-board";
const DASHBOARD_ITEM_SIZE = {
  width: 228,
  height: 228,
};
const DASHBOARD_PINNED_GROUP_SIZE = {
  width: 760,
  height: 380,
};
const DASHBOARD_PINNED_LIST_SIZE = {
  width: 740,
  height: 420,
};
const DASHBOARD_GROUP_SIZE = {
  width: 780,
  height: 400,
};

const emptyGroupForm = {
  id: "",
  title: "",
  description: "",
  accent: accentOptions[0],
  coverUrl: "",
  cornerRadius: 28,
};

function buildPinnedItems(
  collections: ReturnType<typeof useAppData>["collections"],
  t: ReturnType<typeof useI18n>["t"]
) {
  return [
    ...collections.links
      .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.statusText || item.description || item.url,
        route: "/links",
        collectionName: "links" as const,
        entity: item,
        avatarUrl: resolveLinkIconUrl({
          url: item.url,
          customIconUrl: item.customIconUrl,
          iconUrl: item.iconUrl,
        }),
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
    ...collections.listItems
      .filter((item) => item.pinned && !item.deletedAt && !item.archivedAt)
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.description || item.itemNotes || t("lists"),
        route: item.listId ? `/lists/${item.listId}` : "/lists",
        collectionName: "listItems" as const,
        entity: item,
        avatarUrl: item.imageUrl || undefined,
        avatarLabel: "I",
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
  ] satisfies DashboardPinnedItem[];
}

function isPinnedFrameItem(item: DashboardPinnedItem) {
  return (
    item.collectionName === "linkGroups" ||
    item.collectionName === "taskGroups" ||
    item.collectionName === "noteGroups" ||
    item.collectionName === "lists"
  );
}

function getDashboardPinnedItemSize(item: DashboardPinnedItem) {
  if (
    item.collectionName === "linkGroups" ||
    item.collectionName === "taskGroups" ||
    item.collectionName === "noteGroups"
  ) {
    return DASHBOARD_PINNED_GROUP_SIZE;
  }

  if (item.collectionName === "lists") {
    return DASHBOARD_PINNED_LIST_SIZE;
  }

  return DASHBOARD_ITEM_SIZE;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(DASHBOARD_SPACE);
  const { t } = useI18n();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);

  const groups = useMemo(
    () => filterActive(collections.dashboardGroups).filter((item) => !item.archivedAt),
    [collections.dashboardGroups]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter(
        (item) =>
          !item.archivedAt &&
          (item.space === DASHBOARD_SPACE ||
            (!!item.pinned && !!item.spacePlacements?.[DASHBOARD_SPACE]))
      ),
    [collections.boardTexts]
  );
  const pinnedItems = useMemo(() => buildPinnedItems(collections, t), [collections, t]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const groupPlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();

    groups.forEach((group, index) => {
      map.set(
        group.id,
        group.spacePlacements?.[DASHBOARD_SPACE] ??
          createGridPlacement(index, {
            startX: 120,
            startY: 120,
            width: DASHBOARD_GROUP_SIZE.width,
            height: DASHBOARD_GROUP_SIZE.height,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
      );
    });

    return map;
  }, [groups]);

  const groupedPinnedItems = useMemo(() => {
    const map = new Map<string | null, DashboardPinnedItem[]>();

    pinnedItems.forEach((item) => {
      const bucket = map.get(item.entity.dashboardGroupId ?? null) ?? [];
      bucket.push(item);
      map.set(item.entity.dashboardGroupId ?? null, bucket);
    });

    return map;
  }, [pinnedItems]);

  const nodes = useMemo<Array<SpaceCanvasNode<DashboardNodeData>>>(() => {
    const groupNodes: Array<SpaceCanvasNode<DashboardNodeData>> = groups.map((group) => ({
      id: `group-${group.id}`,
      data: {
        kind: "group",
        group,
        itemCount: pinnedItems.filter((item) => item.entity.dashboardGroupId === group.id).length,
      },
      placement:
        groupPlacements.get(group.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: DASHBOARD_GROUP_SIZE.width,
          height: DASHBOARD_GROUP_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      resizable: true,
      minSize: {
        width: 460,
        height: 280,
      },
      zIndex: 5,
    }));

    const itemNodes: Array<SpaceCanvasNode<DashboardNodeData>> = pinnedItems.map((item, index) => {
      const itemSize = getDashboardPinnedItemSize(item);
      const parentGroup = item.entity.dashboardGroupId
        ? groups.find((group) => group.id === item.entity.dashboardGroupId) ?? null
        : null;
      const siblingIndex = (groupedPinnedItems.get(item.entity.dashboardGroupId ?? null) ?? []).findIndex(
        (entry) => entry.id === item.id
      );
      const parentPlacement = parentGroup
        ? groupPlacements.get(parentGroup.id) ??
          createGridPlacement(0, {
            startX: 120,
            startY: 120,
            width: DASHBOARD_GROUP_SIZE.width,
            height: DASHBOARD_GROUP_SIZE.height,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        : null;

      const fallbackPlacement = parentGroup && parentPlacement
        ? createContainerPlacement(
            parentPlacement,
            siblingIndex,
            itemSize,
            LINK_GROUP_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: isPinnedFrameItem(item) ? 1280 : 1840,
            startY: 140,
            width: itemSize.width,
            height: itemSize.height,
            columns: isPinnedFrameItem(item) ? 2 : 5,
            gapX: 28,
            gapY: 28,
          });

      return {
        id: `item-${item.id}`,
        data: {
          kind: "item",
          item,
          group: parentGroup,
        },
        placement: item.entity.spacePlacements?.[DASHBOARD_SPACE] ?? fallbackPlacement,
        zIndex: 18,
      };
    });

    const textNodes: Array<SpaceCanvasNode<DashboardNodeData>> = boardTexts.map((text, index) => {
      const textSize = getBoardTextPlacementSize(text);
      const basePlacement =
        text.spacePlacements?.[DASHBOARD_SPACE] ??
        createGridPlacement(index, {
          startX: 1040,
          startY: 120,
          width: textSize.width,
          height: textSize.height,
          columns: 2,
          gapX: 28,
          gapY: 28,
        });

      return {
        id: `text-${text.id}`,
        data: {
          kind: "text",
          text,
        },
        placement: {
          ...basePlacement,
          width: textSize.width,
          height: textSize.height,
        },
        resizable: true,
        resizeMode: "font-size",
        minSize: {
          width: 220,
          height: 120,
        },
        zIndex: 60,
      };
    });

    return [...groupNodes, ...itemNodes, ...textNodes];
  }, [boardTexts, groupPlacements, groupedPinnedItems, groups, pinnedItems]);

  const finderItems = useMemo<Array<SpaceObjectFinderItem>>(
    () =>
      nodes.map((node) => {
        if (node.data.kind === "group") {
          return {
            id: node.id,
            title: node.data.group.title,
            subtitle: node.data.group.description || t("dashboard"),
            kindLabel: t("objectTypeGroup"),
            placement: node.placement,
          };
        }

        if (node.data.kind === "text") {
          return {
            id: node.id,
            title:
              node.data.text.content
                .split("\n")
                .map((line) => line.trim())
                .find(Boolean) || t("createText"),
            subtitle: t("dashboard"),
            kindLabel: t("objectTypeText"),
            placement: node.placement,
          };
        }

        const kindLabelMap = {
          links: t("objectTypeLink"),
          linkGroups: t("objectTypeGroup"),
          taskGroups: t("objectTypeGroup"),
          tasks: t("objectTypeTask"),
          listItems: t("objectTypeItem"),
          notes: t("objectTypeNote"),
          noteGroups: t("objectTypeGroup"),
          lists: t("objectTypeList"),
        } as const;

        return {
          id: node.id,
          title: node.data.item.title,
          subtitle: node.data.item.subtitle,
          kindLabel: kindLabelMap[node.data.item.collectionName],
          placement: node.placement,
        };
      }),
    [nodes, t]
  );

  const getSidePanelGroupId = (groupId: string) => `group-${groupId}`;

  const sidePanelItems: Array<SpaceSidePanelItem> = [
      ...[...groups]
        .sort((left, right) => left.order - right.order)
        .map((group) => ({
          id: getSidePanelGroupId(group.id),
          title: group.title,
          subtitle: group.description || t("dashboard"),
          kind: "group" as const,
          accentClassName: group.accent,
          previewImageUrl: group.coverUrl || undefined,
          actions: [
            {
              id: `edit-group-${group.id}`,
              icon: <PencilLine className="h-4 w-4" />,
              label: t("edit"),
              onClick: () => {
                openEditGroup(group);
              },
            },
            {
              id: `delete-group-${group.id}`,
              icon: <Trash2 className="h-4 w-4" />,
              label: t("delete"),
              onClick: () => {
                void deleteGroup(group);
              },
              tone: "danger" as const,
            },
          ],
        })),
      ...pinnedItems.map((item) => ({
        id: `item-${item.id}`,
        parentId: item.entity.dashboardGroupId ? getSidePanelGroupId(item.entity.dashboardGroupId) : null,
        title: item.title,
        subtitle: item.subtitle,
        kind: "item" as const,
        previewImageUrl: "avatarUrl" in item ? item.avatarUrl : undefined,
        previewLabel: item.avatarLabel,
        draggable: true,
        onClick: () => {
          navigate(item.route);
        },
        actions: [
          {
            id: `open-${item.id}`,
            icon: <PencilLine className="h-4 w-4" />,
            label: t("open"),
            onClick: () => {
              navigate(item.route);
            },
          },
          {
            id: `unpin-${item.id}`,
            icon: <PinOff className="h-4 w-4" />,
            label: t("unpin"),
            onClick: () => {
              void saveItem(item.collectionName, togglePinned(item.entity) as never);
            },
          },
          {
            id: `favorite-${item.id}`,
            icon: <PencilLine className="h-4 w-4" />,
            label: item.entity.favorite ? t("removeFavorite") : t("favorite"),
            onClick: () => {
              void saveItem(
                item.collectionName,
                ensureShortcutBoardPlacements(
                  toggleFavorite(item.entity),
                  settings,
                  getDashboardPinnedItemSize(item)
                ) as never
              );
            },
          },
          {
            id: `delete-${item.id}`,
            icon: <Trash2 className="h-4 w-4" />,
            label: t("delete"),
            onClick: () => {
              void hardDelete(item.collectionName, item.entity.id);
            },
            tone: "danger" as const,
          },
          ],
        })),
    ];

  async function handleSidePanelMovePinnedItem(
    itemId: string,
    targetGroupPanelId: string | null
  ) {
    const pinnedId = itemId.replace(/^item-/, "");
    const targetGroupId = targetGroupPanelId?.replace(/^group-/, "") ?? null;
    const item = pinnedItems.find((entry) => entry.id === pinnedId);
    const targetGroup = targetGroupId
      ? groups.find((entry) => entry.id === targetGroupId) ?? null
      : null;

    if (!item || item.entity.dashboardGroupId === targetGroupId) {
      return;
    }

    const itemSize = getDashboardPinnedItemSize(item);

    if (!targetGroup) {
      await saveItem(
        item.collectionName,
        ensureEntityCenteredInSpace(
          setDashboardGroupId(item.entity, null),
          DASHBOARD_SPACE,
          viewport,
          itemSize
        ) as never
      );
      return;
    }

    const targetPlacement =
      groupPlacements.get(targetGroup.id) ??
      createGridPlacement(0, {
        startX: 120,
        startY: 120,
        width: DASHBOARD_GROUP_SIZE.width,
        height: DASHBOARD_GROUP_SIZE.height,
        columns: 2,
        gapX: 48,
        gapY: 48,
      });
    const siblingCount = pinnedItems.filter(
      (entry) => entry.entity.dashboardGroupId === targetGroup.id && entry.id !== item.id
    ).length;
    const { container, placement } = createContainerPlacement(
      targetPlacement,
      siblingCount,
      itemSize,
      LINK_GROUP_LAYOUT
    );

    await Promise.all([
      saveItem(
        item.collectionName,
        setSpacePlacement(
          setDashboardGroupId(item.entity, targetGroup.id),
          DASHBOARD_SPACE,
          placement
        ) as never
      ),
      container.width !== targetPlacement.width || container.height !== targetPlacement.height
        ? saveItem("dashboardGroups", setSpacePlacement(targetGroup, DASHBOARD_SPACE, container))
        : Promise.resolve(),
    ]);
  }

  const selectedGroupItems = useMemo(
    () =>
      selectedGroup
        ? pinnedItems.filter((item) => item.entity.dashboardGroupId === selectedGroup.id)
        : [],
    [pinnedItems, selectedGroup]
  );

  function openCreateGroup() {
    setGroupForm({
      ...emptyGroupForm,
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
    });
    setGroupModalOpen(true);
  }

  function openEditGroup(group: DashboardGroup) {
    setSelectedGroupId(null);
    setGroupForm({
      id: group.id,
      title: group.title,
      description: group.description,
      accent: group.accent,
      coverUrl: group.coverUrl,
      cornerRadius: group.cornerRadius,
    });
    setGroupModalOpen(true);
  }

  function openCreateText() {
    const draftText = upsertEntity<BoardTextItem>(
      undefined,
      {
        title: "",
        description: "",
        space: DASHBOARD_SPACE,
        content: "",
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
        fontSize: DEFAULT_TEXT_STYLE.fontSize,
        textColor: DEFAULT_TEXT_STYLE.textColor,
        backgroundColor: DEFAULT_TEXT_STYLE.backgroundColor,
        tone: DEFAULT_TEXT_STYLE.tone,
        cornerRadius: 0,
      },
      nextOrder(collections.boardTexts)
    );
    const nextText = ensureEntityCenteredInSpace(
      draftText,
      DASHBOARD_SPACE,
      viewport,
      getBoardTextPlacementSize(draftText)
    );

    setSelectedTextId(nextText.id);
    void saveItem("boardTexts", nextText);
  }

  async function saveGroupCard() {
    const current = collections.dashboardGroups.find((item) => item.id === groupForm.id);
    let nextGroup = upsertEntity<DashboardGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        accent: groupForm.accent,
        coverUrl: groupForm.coverUrl,
        cornerRadius: groupForm.cornerRadius,
      },
      current?.order ?? nextOrder(collections.dashboardGroups)
    );

    if (!nextGroup.spacePlacements?.[DASHBOARD_SPACE]) {
      nextGroup = ensureEntityCenteredInSpace(
        nextGroup,
        DASHBOARD_SPACE,
        viewport,
        DASHBOARD_GROUP_SIZE
      );
    }

    await saveItem("dashboardGroups", nextGroup);
    setGroupModalOpen(false);
  }

  async function deleteGroup(group: DashboardGroup) {
    const updates = new Map<
      DashboardPinnedItem["collectionName"],
      DashboardPinnedItem["entity"][]
    >();

    pinnedItems.forEach((item) => {
      if (item.entity.dashboardGroupId !== group.id) {
        return;
      }

      const bucket = updates.get(item.collectionName) ?? [];
      bucket.push(setDashboardGroupId(item.entity, null));
      updates.set(item.collectionName, bucket);
    });

    await Promise.all([
      ...Array.from(updates.entries()).map(([collectionName, changedItems]) => {
        const untouched = collections[collectionName].filter(
          (item) => !changedItems.some((entry) => entry.id === item.id)
        );

        return saveMany(collectionName, [...untouched, ...changedItems] as never[]);
      }),
      hardDelete("dashboardGroups", group.id),
    ]);

    setSelectedGroupId((current) => (current === group.id ? null : current));
  }

  async function handleGroupPlacementCommit(
    group: DashboardGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;
    const changedByCollection = new Map<
      DashboardPinnedItem["collectionName"],
      DashboardPinnedItem["entity"][]
    >();

    pinnedItems.forEach((item) => {
      if (item.entity.dashboardGroupId !== group.id) {
        return;
      }

      const itemSize = getDashboardPinnedItemSize(item);
      const currentPlacement =
        item.entity.spacePlacements?.[DASHBOARD_SPACE] ??
        createContainerPlacement(previousPlacement, 0, itemSize, LINK_GROUP_LAYOUT)
          .placement;
      const bucket = changedByCollection.get(item.collectionName) ?? [];

      bucket.push(
        setSpacePlacement(item.entity, DASHBOARD_SPACE, {
          ...currentPlacement,
          x: currentPlacement.x + deltaX,
          y: currentPlacement.y + deltaY,
        })
      );
      changedByCollection.set(item.collectionName, bucket);
    });

    await Promise.all([
      saveItem("dashboardGroups", setSpacePlacement(group, DASHBOARD_SPACE, placement)),
      ...Array.from(changedByCollection.entries()).map(([collectionName, changedItems]) => {
        const untouched = collections[collectionName].filter(
          (item) => !changedItems.some((entry) => entry.id === item.id)
        );

        return saveMany(collectionName, [...untouched, ...changedItems] as never[]);
      }),
    ]);
  }

  async function handlePinnedPlacementCommit(
    item: DashboardPinnedItem,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const targetGroup = getInnermostContainingEntry(
      placement,
      groups,
      (group) =>
        groupPlacements.get(group.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: DASHBOARD_GROUP_SIZE.width,
          height: DASHBOARD_GROUP_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      18
    );

    await saveItem(
      item.collectionName,
      setSpacePlacement(
        setDashboardGroupId(item.entity, targetGroup?.id ?? null),
        DASHBOARD_SPACE,
        placement
      ) as never
    );
  }

  return (
    <div className="relative h-full">
      {!listMode ? (
        <SpaceSidePanel
          actions={
            <Button className="rounded-full" onClick={openCreateGroup} variant="secondary">
              {t("createDashboardGroup")}
            </Button>
          }
          items={sidePanelItems}
          onMoveItem={(itemId, targetGroupId) => {
            void handleSidePanelMovePinnedItem(itemId, targetGroupId);
          }}
          title={t("dashboard")}
        />
      ) : null}

      {!listMode ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
          <div className="pointer-events-auto">
            <Button className="rounded-full" onClick={openCreateGroup} variant="secondary">
              {t("createDashboardGroup")}
            </Button>
          </div>
          <div className="pointer-events-auto">
            <Button className="rounded-full" onClick={openCreateText} variant="secondary">
              {t("createText")}
            </Button>
          </div>
        </div>
      ) : null}

      {listMode ? (
        <SpaceListMode
          actions={
            <Button className="rounded-full" onClick={openCreateGroup} variant="secondary">
              {t("createDashboardGroup")}
            </Button>
          }
          items={sidePanelItems}
          onExit={() => setListMode(false)}
          onMoveItem={(itemId, targetGroupId) => {
            void handleSidePanelMovePinnedItem(itemId, targetGroupId);
          }}
          title={t("dashboard")}
        />
      ) : (
        <SpaceCanvas
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        emptyState={
          <EmptyState
            description={t("dashboardEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "group") {
            setSelectedTextId(null);
            setSelectedGroupId(node.data.group.id);
            return;
          }

          if (node.data.kind === "text") {
            return;
          }

          setSelectedTextId(null);
          navigate(node.data.item.route);
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "group") {
            return [];
          }

          const groupNode = node.data;

          return pinnedItems
            .filter((item) => item.entity.dashboardGroupId === groupNode.group.id)
            .map((item) => `item-${item.id}`);
        }}
        onPlacementCommit={(id, placement) => {
          const node = nodes.find((item) => item.id === id);

          if (!node) {
            return;
          }

          if (node.data.kind === "group") {
            void handleGroupPlacementCommit(node.data.group, placement);
            return;
          }

          if (node.data.kind === "text") {
            void saveItem("boardTexts", setSpacePlacement(node.data.text, DASHBOARD_SPACE, placement));
            return;
          }

          void handlePinnedPlacementCommit(node.data.item, placement);
        }}
        onViewportChange={setViewport}
        onFontResizeCommit={({ id, origin, preview }) => {
          const text = boardTexts.find((entry) => `text-${entry.id}` === id);

          if (!text) {
            return;
          }

          void saveItem("boardTexts", {
            ...text,
            fontSize: getFontSizeFromResize({
              currentFontSize: text.fontSize,
              origin,
              preview,
              max: 160,
            }),
          });
        }}
        renderNode={(node, options) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <CanvasFrame
                accent={groupNode.group.accent}
                cornerRadius={groupNode.group.cornerRadius}
                count={groupNode.itemCount}
                coverUrl={groupNode.group.coverUrl}
                isDragging={options.isDragging}
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
                        <MoreHorizontal className="h-4 w-4 text-white" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditGroup(groupNode.group)}>
                        {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void deleteGroup(groupNode.group)}>
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
                placementWidth={node.placement.width}
                subtitle={groupNode.group.description || t("dashboard")}
                title={groupNode.group.title}
              />
            );
          }

          if (node.data.kind === "text") {
            const textNode = node.data;

            return (
              <BoardTextCard
                className="cursor-grab active:cursor-grabbing"
                active={selectedTextId === textNode.text.id}
                item={textNode.text}
                onActivate={() => setSelectedTextId(textNode.text.id)}
                onDeactivate={() =>
                  setSelectedTextId((current) =>
                    current === textNode.text.id ? null : current
                  )
                }
                onSave={(patch) =>
                  void saveItem("boardTexts", {
                    ...textNode.text,
                    ...patch,
                  })
                }
                onTogglePin={() =>
                  void saveItem(
                    "boardTexts",
                    ensureShortcutBoardPlacements(
                      togglePinned(textNode.text),
                      settings,
                      getBoardTextPlacementSize(textNode.text)
                    )
                  )
                }
                onToggleFavorite={() =>
                  void saveItem(
                    "boardTexts",
                    ensureShortcutBoardPlacements(
                      toggleFavorite(textNode.text),
                      settings,
                      getBoardTextPlacementSize(textNode.text)
                    )
                  )
                }
                onArchive={() => void saveItem("boardTexts", toggleArchive(textNode.text))}
                onDelete={() => void hardDelete("boardTexts", textNode.text.id)}
                previewFontSize={getFontSizeFromResize({
                  currentFontSize: textNode.text.fontSize,
                  origin: node.placement,
                  preview: options.previewPlacement,
                  max: 160,
                })}
              />
            );
          }

          const item = node.data.item;
          const itemMenu = (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-space-no-drag="true"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  size="icon"
                  variant="ghost"
                >
                  <MoreHorizontal
                    className={isPinnedFrameItem(item) ? "h-4 w-4 text-white" : "h-4 w-4"}
                  />
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
                    void saveItem(
                      item.collectionName,
                      ensureShortcutBoardPlacements(
                        toggleFavorite(item.entity),
                        settings,
                        getDashboardPinnedItemSize(item)
                      ) as never
                    )
                  }
                >
                  {item.entity.favorite ? t("removeFavorite") : t("favorite")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );

          if (isPinnedFrameItem(item)) {
            return (
              <DashboardPinnedFrameCard
                collections={collections}
                isDragging={options.isDragging}
                item={item}
                menu={itemMenu}
                placementWidth={node.placement.width}
              />
            );
          }

          return (
            <ObjectTileCard
              avatarLabel={item.avatarLabel}
              avatarUrl={item.avatarUrl}
              className="cursor-grab active:cursor-grabbing"
              menu={itemMenu}
              subtitle={item.subtitle}
              title={item.title}
            />
          );
        }}
        size={{ width: 4200, height: 2600 }}
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

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setGroupModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveGroupCard()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setGroupModalOpen(false)}
        open={groupModalOpen}
        title={groupForm.id ? t("edit") : t("createDashboardGroup")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderListTitle")}
              value={groupForm.title}
            />
          </Field>
          <Field label={t("fieldAccent")}>
            <Select
              onChange={(event) => setGroupForm((current) => ({ ...current, accent: event.target.value }))}
              value={groupForm.accent}
            >
              {accentOptions.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label={t("fieldDescription")}>
              <Textarea
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t("placeholderListDescription")}
                value={groupForm.description}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t("fieldPhoto")}>
              <Input
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, coverUrl: event.target.value }))
                }
                placeholder="https://image..."
                value={groupForm.coverUrl}
              />
            </Field>
          </div>
          <Field hint={`${groupForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={48}
              min={10}
              onChange={(event) =>
                setGroupForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={groupForm.cornerRadius}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setSelectedGroupId(null)}>{t("cancel")}</Button>
          </div>
        }
        onClose={() => setSelectedGroupId(null)}
        open={!!selectedGroup}
        size="lg"
        title={selectedGroup?.title || t("createDashboardGroup")}
      >
        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              {selectedGroup.description ? (
                <p className="text-sm leading-6 text-[var(--app-muted)]">
                  {selectedGroup.description}
                </p>
              ) : <div />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditGroup(selectedGroup)}>
                    {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void deleteGroup(selectedGroup)}>
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {selectedGroupItems.length ? (
              <div className="space-y-3">
                {selectedGroupItems.map((item) => (
                  <button
                    className="flex w-full items-center justify-between rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                    key={item.id}
                    onClick={() => navigate(item.route)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--app-text)]">{item.title}</p>
                      <p className="truncate text-sm text-[var(--app-muted)]">{item.subtitle}</p>
                    </div>
                    <Badge>{t("open")}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState description={t("noGroup")} title="" />
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DashboardPinnedFrameCard({
  item,
  collections,
  placementWidth,
  isDragging,
  menu,
}: {
  item: DashboardPinnedItem;
  collections: ReturnType<typeof useAppData>["collections"];
  placementWidth: number;
  isDragging?: boolean;
  menu?: React.ReactNode;
}) {
  const { t } = useI18n();

  if (item.collectionName === "linkGroups") {
    const group = item.entity as CollectionMap["linkGroups"];
    const links = filterActive(collections.links)
      .filter((entry) => !entry.archivedAt && entry.groupId === group.id)
      .slice(0, 6);
    const totalCount = filterActive(collections.links).filter(
      (entry) => !entry.archivedAt && entry.groupId === group.id
    ).length;

    return (
      <CanvasFrame
        accent={group.accent}
        cornerRadius={group.cornerRadius}
        count={totalCount}
        isDragging={isDragging}
        menu={menu}
        placementWidth={placementWidth}
        subtitle={group.description || t("links")}
        title={group.title}
      >
        {links.length ? (
          <div className="pointer-events-none grid h-full auto-rows-fr grid-cols-3 gap-3">
            {links.map((link) => (
              <div
                className="flex min-h-0 items-center gap-3 overflow-hidden border border-white/10 bg-black/35 px-3 py-3 backdrop-blur-sm"
                key={link.id}
                style={{ borderRadius: link.cornerRadius }}
              >
                <img
                  alt={link.title}
                  className="h-10 w-10 rounded-full object-cover"
                  draggable={false}
                  src={resolveLinkIconUrl({
                    url: link.url,
                    customIconUrl: link.customIconUrl,
                    iconUrl: link.iconUrl,
                  })}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white/95">{link.title}</p>
                  <p className="truncate text-[11px] text-white/60">
                    {link.statusText || link.description || link.url}
                  </p>
                </div>
              </div>
            ))}
            {totalCount > links.length ? (
              <DashboardPreviewOverflow count={totalCount - links.length} />
            ) : null}
          </div>
        ) : (
          <DashboardPreviewEmpty label={t("noGroup")} />
        )}
      </CanvasFrame>
    );
  }

  if (item.collectionName === "taskGroups") {
    const group = item.entity as CollectionMap["taskGroups"];
    const tasks = filterActive(collections.tasks)
      .filter(
        (entry) =>
          !entry.archivedAt &&
          entry.groupId === group.id &&
          entry.taskStatus === "todo"
      )
      .slice(0, 4);
    const totalCount = filterActive(collections.tasks).filter(
      (entry) =>
        !entry.archivedAt &&
        entry.groupId === group.id &&
        entry.taskStatus === "todo"
    ).length;
    const priorityLabelMap = {
      low: t("priorityLow"),
      medium: t("priorityMedium"),
      high: t("priorityHigh"),
      urgent: t("priorityUrgent"),
    } as const;

    return (
      <CanvasFrame
        accent={group.accent}
        cornerRadius={group.cornerRadius}
        count={totalCount}
        isDragging={isDragging}
        menu={menu}
        placementWidth={placementWidth}
        subtitle={group.description || t("tasks")}
        title={group.title}
      >
        {tasks.length ? (
          <div className="pointer-events-none grid h-full auto-rows-fr grid-cols-2 gap-3">
            {tasks.map((task) => (
              <div
                className="flex min-h-0 flex-col justify-between overflow-hidden border border-white/10 bg-black/35 p-3 backdrop-blur-sm"
                key={task.id}
                style={{ borderRadius: task.cornerRadius }}
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold text-white/95">{task.title}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/60">
                    {task.description || priorityLabelMap[task.priority]}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="border-white/10 bg-black/30 text-white/70">
                    {priorityLabelMap[task.priority]}
                  </Badge>
                </div>
              </div>
            ))}
            {totalCount > tasks.length ? (
              <DashboardPreviewOverflow count={totalCount - tasks.length} />
            ) : null}
          </div>
        ) : (
          <DashboardPreviewEmpty label={t("noGroup")} />
        )}
      </CanvasFrame>
    );
  }

  if (item.collectionName === "noteGroups") {
    const group = item.entity as CollectionMap["noteGroups"];
    const notes = filterActive(collections.notes)
      .filter((entry) => !entry.archivedAt && entry.groupId === group.id)
      .slice(0, 6);
    const totalCount = filterActive(collections.notes).filter(
      (entry) => !entry.archivedAt && entry.groupId === group.id
    ).length;

    return (
      <CanvasFrame
        accent={group.accent}
        cornerRadius={group.cornerRadius}
        count={totalCount}
        isDragging={isDragging}
        menu={menu}
        placementWidth={placementWidth}
        subtitle={group.description || t("notes")}
        title={group.title}
      >
        {notes.length ? (
          <div className="pointer-events-none grid h-full auto-rows-fr grid-cols-3 gap-3">
            {notes.map((note) => (
              <div
                className="flex min-h-0 flex-col overflow-hidden border border-white/10 bg-black/35 p-3 backdrop-blur-sm"
                key={note.id}
                style={{ borderRadius: note.cornerRadius }}
              >
                <p className="truncate text-sm font-semibold text-white/95">{note.title}</p>
                <p className="mt-2 line-clamp-4 text-xs leading-5 text-white/60">
                  {note.description || note.content}
                </p>
              </div>
            ))}
            {totalCount > notes.length ? (
              <DashboardPreviewOverflow count={totalCount - notes.length} />
            ) : null}
          </div>
        ) : (
          <DashboardPreviewEmpty label={t("noGroup")} />
        )}
      </CanvasFrame>
    );
  }

  const list = item.entity as CollectionMap["lists"];
  const listItems = filterActive(collections.listItems)
    .filter((entry) => !entry.archivedAt && entry.listId === list.id)
    .slice(0, 6);
  const totalCount = filterActive(collections.listItems).filter(
    (entry) => !entry.archivedAt && entry.listId === list.id
  ).length;

  return (
    <CanvasFrame
      accent={list.accent}
      cornerRadius={list.cornerRadius}
      count={totalCount}
      coverUrl={list.coverUrl || undefined}
      isDragging={isDragging}
      menu={menu}
      placementWidth={placementWidth}
      subtitle={list.description || list.listType || t("lists")}
      title={list.title}
    >
      {listItems.length ? (
        <div className="pointer-events-none grid h-full auto-rows-fr grid-cols-3 gap-3">
          {listItems.map((entry) => (
            <div
              className="flex min-h-0 flex-col overflow-hidden border border-white/10 bg-black/35 backdrop-blur-sm"
              key={entry.id}
              style={{ borderRadius: entry.cornerRadius }}
            >
              {entry.imageUrl ? (
                <img
                  alt={entry.title}
                  className="h-20 w-full object-cover"
                  draggable={false}
                  src={entry.imageUrl}
                />
              ) : (
                <div className={`h-20 bg-gradient-to-br ${list.accent}`} />
              )}
              <div className="min-h-0 flex-1 p-3">
                <p className="truncate text-xs font-semibold text-white/95">{entry.title}</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/60">
                  {entry.description || entry.itemNotes || t("lists")}
                </p>
              </div>
            </div>
          ))}
          {totalCount > listItems.length ? (
            <DashboardPreviewOverflow count={totalCount - listItems.length} />
          ) : null}
        </div>
      ) : (
        <DashboardPreviewEmpty label={t("lists")} />
      )}
    </CanvasFrame>
  );
}

function DashboardPreviewEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/25 px-4 text-center text-xs text-white/55">
      {label}
    </div>
  );
}

function DashboardPreviewOverflow({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center rounded-[22px] border border-white/10 bg-black/35 px-3 py-3 text-base font-semibold text-white/70 backdrop-blur-sm">
      +{count}
    </div>
  );
}
