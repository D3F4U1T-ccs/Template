import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import {
  BoardTextEditorModal,
  type BoardTextFormState,
} from "@/components/ui/board-text-editor-modal";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { Modal } from "@/components/ui/modal";
import { ObjectTileCard } from "@/components/ui/object-tile-card";
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
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_STYLE,
  LINK_GROUP_LAYOUT,
  createContainerPlacement,
  ensureEntityCenteredInSpace,
  ensureShortcutBoardPlacements,
} from "@/utils/board";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";

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

const emptyTextForm: BoardTextFormState = {
  id: "",
  content: "",
  fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
  fontSize: DEFAULT_TEXT_STYLE.fontSize,
  textColor: DEFAULT_TEXT_STYLE.textColor,
  tone: DEFAULT_TEXT_STYLE.tone,
  cornerRadius: 26,
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(DASHBOARD_SPACE);
  const { t } = useI18n();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [textForm, setTextForm] = useState(emptyTextForm);

  const groups = useMemo(
    () => filterActive(collections.dashboardGroups).filter((item) => !item.archivedAt),
    [collections.dashboardGroups]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter((item) => item.space === DASHBOARD_SPACE),
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
            DASHBOARD_ITEM_SIZE,
            LINK_GROUP_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: DASHBOARD_ITEM_SIZE.width,
            height: DASHBOARD_ITEM_SIZE.height,
            columns: 5,
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

    const textNodes: Array<SpaceCanvasNode<DashboardNodeData>> = boardTexts.map((text, index) => ({
      id: `text-${text.id}`,
      data: {
        kind: "text",
        text,
      },
      placement:
        text.spacePlacements?.[DASHBOARD_SPACE] ??
        createGridPlacement(index, {
          startX: 1040,
          startY: 120,
          width: DEFAULT_TEXT_SIZE.width,
          height: DEFAULT_TEXT_SIZE.height,
          columns: 2,
          gapX: 28,
          gapY: 28,
        }),
      resizable: true,
      minSize: {
        width: 220,
        height: 120,
      },
      zIndex: 24,
    }));

    return [...groupNodes, ...itemNodes, ...textNodes];
  }, [boardTexts, groupPlacements, groupedPinnedItems, groups, pinnedItems]);

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
    setTextForm(emptyTextForm);
    setTextModalOpen(true);
  }

  function openEditText(text: BoardTextItem) {
    setTextForm({
      id: text.id,
      content: text.content,
      fontFamily: text.fontFamily,
      fontSize: text.fontSize,
      textColor: text.textColor,
      tone: text.tone,
      cornerRadius: text.cornerRadius,
    });
    setTextModalOpen(true);
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

  async function saveTextCard() {
    const current = collections.boardTexts.find((item) => item.id === textForm.id);
    let nextText = upsertEntity<BoardTextItem>(
      current,
      {
        title: "",
        description: "",
        space: DASHBOARD_SPACE,
        content: textForm.content,
        fontFamily: textForm.fontFamily,
        fontSize: textForm.fontSize,
        textColor: textForm.textColor,
        tone: textForm.tone,
        cornerRadius: textForm.cornerRadius,
      },
      current?.order ?? nextOrder(collections.boardTexts)
    );

    if (!nextText.spacePlacements?.[DASHBOARD_SPACE]) {
      nextText = ensureEntityCenteredInSpace(
        nextText,
        DASHBOARD_SPACE,
        viewport,
        DEFAULT_TEXT_SIZE
      );
    }

    await saveItem("boardTexts", nextText);
    setTextModalOpen(false);
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

      const currentPlacement =
        item.entity.spacePlacements?.[DASHBOARD_SPACE] ??
        createContainerPlacement(previousPlacement, 0, DASHBOARD_ITEM_SIZE, LINK_GROUP_LAYOUT)
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
    const targetGroup = groups
      .map((group) => ({
        group,
        overlap: getPlacementOverlapRatio(
          placement,
          groupPlacements.get(group.id) ??
            createGridPlacement(0, {
              startX: 120,
              startY: 120,
              width: DASHBOARD_GROUP_SIZE.width,
              height: DASHBOARD_GROUP_SIZE.height,
              columns: 2,
              gapX: 48,
              gapY: 48,
            })
        ),
      }))
      .sort((left, right) => right.overlap - left.overlap)
      .find((entry) => entry.overlap >= 0.5);

    await saveItem(
      item.collectionName,
      setSpacePlacement(
        setDashboardGroupId(item.entity, targetGroup?.group.id ?? null),
        DASHBOARD_SPACE,
        placement
      ) as never
    );
  }

  return (
    <div className="relative h-full">
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
            setSelectedGroupId(node.data.group.id);
            return;
          }

          if (node.data.kind === "text") {
            openEditText(node.data.text);
            return;
          }

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
                item={textNode.text}
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
                      <DropdownMenuItem onClick={() => openEditText(textNode.text)}>
                        {t("editText")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void hardDelete("boardTexts", textNode.text.id)}
                      >
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            );
          }

          const item = node.data.item;

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
                        void saveItem(
                          item.collectionName,
                          ensureShortcutBoardPlacements(
                            toggleFavorite(item.entity),
                            settings,
                            DASHBOARD_ITEM_SIZE
                          ) as never
                        )
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
        size={{ width: 4200, height: 2600 }}
        viewport={viewport}
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

      <BoardTextEditorModal
        form={textForm}
        onChange={setTextForm}
        onClose={() => setTextModalOpen(false)}
        onSave={() => void saveTextCard()}
        open={textModalOpen}
        title={textForm.id ? t("editText") : t("createText")}
      />
    </div>
  );
}
