import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";

import { accentOptions, defaultListFeatures, listFeatureOptions } from "@/data/app-config";
import { useI18n } from "@/data/i18n";
import { BoardTextCard } from "@/components/ui/board-text-card";
import {
  BoardTextEditorModal,
  type BoardTextFormState,
} from "@/components/ui/board-text-editor-modal";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
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
  ListFeatureConfig,
  SmartList,
  SmartListItem,
  WorkspaceSpaceKey,
} from "@/types/models";
import {
  filterActive,
  getSpacePlacement,
  moveEntity,
  nextOrder,
  setSpacePlacement,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_STYLE,
  LIST_FRAME_LAYOUT,
  createContainerPlacement,
  ensureEntityCenteredInSpace,
  ensureShortcutBoardPlacements,
} from "@/utils/board";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";

const LISTS_SPACE: WorkspaceSpaceKey = "lists-board";
const FRAME_MIN_WIDTH = 420;
const FRAME_MIN_HEIGHT = 280;
const FRAME_DEFAULT_SIZE = {
  width: 740,
  height: 420,
};
const LIST_ITEM_SIZE = {
  width: 184,
  height: 152,
};

type ListBoardNodeData =
  | {
      kind: "frame";
      list: SmartList;
    }
  | {
      kind: "item";
      item: SmartListItem;
      list: SmartList | null;
    }
  | {
      kind: "text";
      text: BoardTextItem;
    };

const emptyListForm = {
  id: "",
  title: "",
  description: "",
  coverUrl: "",
  listType: "",
  accent: accentOptions[0],
  cornerRadius: 28,
  features: { ...defaultListFeatures } as ListFeatureConfig,
};

const emptyItemForm = {
  id: "",
  listId: "",
  title: "",
  description: "",
  imageUrl: "",
  rating: "",
  cornerRadius: 22,
  watched: false,
  progress: "",
  season: "",
  episode: "",
  stoppedAt: "",
  tokenCount: "",
  zeroToken: false,
  itemNotes: "",
  checked: false,
  tags: "",
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

export default function ListsPage() {
  const navigate = useNavigate();
  const { listId } = useParams();
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(LISTS_SPACE);
  const { t } = useI18n();
  const [listModalOpen, setListModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [listForm, setListForm] = useState(emptyListForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [textForm, setTextForm] = useState(emptyTextForm);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const listFeatureCopy = useMemo(
    () => ({
      description: {
        label: t("listFeatureDescription"),
        description: t("listFeatureDescriptionText"),
      },
      image: {
        label: t("listFeatureImage"),
        description: t("listFeatureImageText"),
      },
      rating: {
        label: t("listFeatureRating"),
        description: t("listFeatureRatingText"),
      },
      watched: {
        label: t("listFeatureWatched"),
        description: t("listFeatureWatchedText"),
      },
      progress: {
        label: t("listFeatureProgress"),
        description: t("listFeatureProgressText"),
      },
      seasonEpisode: {
        label: t("listFeatureSeasonEpisode"),
        description: t("listFeatureSeasonEpisodeText"),
      },
      stoppedAt: {
        label: t("listFeatureStoppedAt"),
        description: t("listFeatureStoppedAtText"),
      },
      tokenCount: {
        label: t("listFeatureTokenCount"),
        description: t("listFeatureTokenCountText"),
      },
      zeroTokenFlag: {
        label: t("listFeatureZeroTokens"),
        description: t("listFeatureZeroTokensText"),
      },
      sortCheckedToBottom: {
        label: t("listFeatureSortChecked"),
        description: t("listFeatureSortCheckedText"),
      },
      tags: {
        label: t("listFeatureTags"),
        description: t("listFeatureTagsText"),
      },
      notes: {
        label: t("listFeatureNotes"),
        description: t("listFeatureNotesText"),
      },
      favorite: {
        label: t("listFeatureFavorite"),
        description: t("listFeatureFavoriteText"),
      },
      check: {
        label: t("listFeatureCheck"),
        description: t("listFeatureCheckText"),
      },
    }),
    [t]
  );

  const lists = useMemo(
    () => filterActive(collections.lists).filter((item) => !item.archivedAt),
    [collections.lists]
  );
  const activeItems = useMemo(
    () => filterActive(collections.listItems).filter((item) => !item.archivedAt),
    [collections.listItems]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter((item) => item.space === LISTS_SPACE),
    [collections.boardTexts]
  );

  const selectedList = useMemo(
    () => lists.find((item) => item.id === listId) ?? null,
    [listId, lists]
  );
  const currentItemList = useMemo(
    () => lists.find((item) => item.id === itemForm.listId) ?? selectedList,
    [itemForm.listId, lists, selectedList]
  );

  const framePlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();

    lists.forEach((list, index) => {
      map.set(
        list.id,
        getSpacePlacement(
          list,
          LISTS_SPACE,
          createGridPlacement(index, {
            startX: 120,
            startY: 120,
            width: FRAME_DEFAULT_SIZE.width,
            height: FRAME_DEFAULT_SIZE.height,
            gapX: 52,
            gapY: 52,
            columns: 2,
          })
        )
      );
    });

    return map;
  }, [lists]);

  const listItems = useMemo(() => {
    if (!selectedList) {
      return [];
    }

    const source = activeItems.filter((item) => item.listId === selectedList.id);

    return selectedList.features.sortCheckedToBottom
      ? [...source].sort((left, right) => Number(left.checked) - Number(right.checked))
      : source;
  }, [activeItems, selectedList]);

  const nodes = useMemo<Array<SpaceCanvasNode<ListBoardNodeData>>>(() => {
    const frameNodes: Array<SpaceCanvasNode<ListBoardNodeData>> = lists.map((list) => ({
      id: `frame-${list.id}`,
      data: {
        kind: "frame",
        list,
      },
      placement:
        framePlacements.get(list.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: FRAME_DEFAULT_SIZE.width,
          height: FRAME_DEFAULT_SIZE.height,
          gapX: 52,
          gapY: 52,
          columns: 2,
        }),
      resizable: true,
      minSize: {
        width: FRAME_MIN_WIDTH,
        height: FRAME_MIN_HEIGHT,
      },
      zIndex: 5,
    }));

    const groupedItems = new Map<string | null, SmartListItem[]>();

    activeItems.forEach((item) => {
      const bucket = groupedItems.get(item.listId) ?? [];
      bucket.push(item);
      groupedItems.set(item.listId, bucket);
    });

    const itemNodes: Array<SpaceCanvasNode<ListBoardNodeData>> = activeItems.map((item, index) => {
      const parentList = item.listId ? lists.find((entry) => entry.id === item.listId) ?? null : null;
      const siblingIndex = (groupedItems.get(item.listId) ?? []).findIndex(
        (entry) => entry.id === item.id
      );
      const parentFramePlacement = parentList
        ? framePlacements.get(parentList.id) ??
          createGridPlacement(0, {
            startX: 120,
            startY: 120,
            width: FRAME_DEFAULT_SIZE.width,
            height: FRAME_DEFAULT_SIZE.height,
            gapX: 52,
            gapY: 52,
            columns: 2,
          })
        : null;

      const fallbackPlacement = parentList && parentFramePlacement
        ? createContainerPlacement(
            parentFramePlacement,
            siblingIndex,
            LIST_ITEM_SIZE,
            LIST_FRAME_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: 1260,
            startY: 140,
            width: LIST_ITEM_SIZE.width,
            height: LIST_ITEM_SIZE.height,
            columns: 4,
            gapX: 24,
            gapY: 24,
          });

      return {
        id: `item-${item.id}`,
        data: {
          kind: "item",
          item,
          list: parentList,
        },
        placement: getSpacePlacement(item, LISTS_SPACE, fallbackPlacement),
        zIndex: 18,
      };
    });

    const textNodes: Array<SpaceCanvasNode<ListBoardNodeData>> = boardTexts.map((text, index) => ({
      id: `text-${text.id}`,
      data: {
        kind: "text",
        text,
      },
      placement: getSpacePlacement(
        text,
        LISTS_SPACE,
        createGridPlacement(index, {
          startX: 940,
          startY: 120,
          width: DEFAULT_TEXT_SIZE.width,
          height: DEFAULT_TEXT_SIZE.height,
          columns: 2,
          gapX: 28,
          gapY: 28,
        })
      ),
      resizable: true,
      minSize: {
        width: 220,
        height: 120,
      },
      zIndex: 24,
    }));

    return [...frameNodes, ...itemNodes, ...textNodes];
  }, [activeItems, boardTexts, framePlacements, lists]);

  function openCreateList() {
    setListForm({
      ...emptyListForm,
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
      features: { ...defaultListFeatures },
    });
    setListModalOpen(true);
  }

  function openEditList(list: SmartList) {
    setListForm({
      id: list.id,
      title: list.title,
      description: list.description,
      coverUrl: list.coverUrl,
      listType: list.listType,
      accent: list.accent,
      cornerRadius: list.cornerRadius,
      features: { ...list.features },
    });
    setListModalOpen(true);
  }

  function openCreateItem(targetListId?: string | null) {
    setItemForm({
      ...emptyItemForm,
      listId: targetListId ?? selectedList?.id ?? "",
    });
    setItemModalOpen(true);
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

  function openEditItem(item: SmartListItem) {
    setItemForm({
      id: item.id,
      listId: item.listId ?? "",
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      rating: item.rating?.toString() ?? "",
      cornerRadius: item.cornerRadius,
      watched: item.watched,
      progress: item.progress?.toString() ?? "",
      season: item.season?.toString() ?? "",
      episode: item.episode?.toString() ?? "",
      stoppedAt: item.stoppedAt,
      tokenCount: item.tokenCount?.toString() ?? "",
      zeroToken: item.zeroToken,
      itemNotes: item.itemNotes,
      checked: item.checked,
      tags: item.tags.join(", "),
    });
    setItemModalOpen(true);
  }

  async function saveListEntry() {
    const current = collections.lists.find((item) => item.id === listForm.id);
    let nextList = upsertEntity<SmartList>(
      current,
      {
        title: listForm.title.trim() || t("untitledFrame"),
        description: listForm.description,
        coverUrl: listForm.coverUrl,
        listType: listForm.listType || "Custom",
        accent: listForm.accent,
        cornerRadius: listForm.cornerRadius,
        features: listForm.features,
      },
      current?.order ?? nextOrder(collections.lists)
    );

    nextList = ensureShortcutBoardPlacements(nextList, settings, FRAME_DEFAULT_SIZE);

    if (!nextList.spacePlacements?.[LISTS_SPACE]) {
      nextList = ensureEntityCenteredInSpace(
        nextList,
        LISTS_SPACE,
        viewport,
        FRAME_DEFAULT_SIZE
      );
    }

    await saveItem("lists", nextList);
    setListModalOpen(false);
    navigate(`/lists/${nextList.id}`);
  }

  async function saveItemEntry() {
    const current = collections.listItems.find((item) => item.id === itemForm.id);

    if (!itemForm.listId) {
      return;
    }

    let nextItem = upsertEntity<SmartListItem>(
      current,
      {
        title: itemForm.title.trim() || t("untitledItem"),
        description: itemForm.description,
        listId: itemForm.listId || null,
        imageUrl: itemForm.imageUrl,
        rating: itemForm.rating ? Number(itemForm.rating) : null,
        cornerRadius: itemForm.cornerRadius,
        watched: itemForm.watched,
        progress: itemForm.progress ? Number(itemForm.progress) : null,
        season: itemForm.season ? Number(itemForm.season) : null,
        episode: itemForm.episode ? Number(itemForm.episode) : null,
        stoppedAt: itemForm.stoppedAt,
        tokenCount: itemForm.tokenCount ? Number(itemForm.tokenCount) : null,
        zeroToken: itemForm.zeroToken,
        itemNotes: itemForm.itemNotes,
        checked: itemForm.checked,
        tags: itemForm.tags.split(",").map((item) => item.trim()).filter(Boolean),
      },
      current?.order ?? nextOrder(collections.listItems)
    );

    nextItem = ensureShortcutBoardPlacements(nextItem, settings, LIST_ITEM_SIZE);
    const targetList = lists.find((list) => list.id === nextItem.listId) ?? null;

    if (targetList && (!current || current.listId !== nextItem.listId)) {
      const targetPlacement =
        framePlacements.get(targetList.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: FRAME_DEFAULT_SIZE.width,
          height: FRAME_DEFAULT_SIZE.height,
          gapX: 52,
          gapY: 52,
          columns: 2,
        });
      const siblingCount = activeItems.filter(
        (item) => item.listId === targetList.id && item.id !== nextItem.id
      ).length;
      const { container, placement } = createContainerPlacement(
        targetPlacement,
        siblingCount,
        LIST_ITEM_SIZE,
        LIST_FRAME_LAYOUT
      );

      nextItem = setSpacePlacement(nextItem, LISTS_SPACE, placement);

      await Promise.all([
        saveItem("listItems", nextItem),
        container.width !== targetPlacement.width || container.height !== targetPlacement.height
          ? saveItem("lists", setSpacePlacement(targetList, LISTS_SPACE, container))
          : Promise.resolve(),
      ]);
    } else {
      if (!nextItem.spacePlacements?.[LISTS_SPACE] && !nextItem.listId) {
        nextItem = ensureEntityCenteredInSpace(
          nextItem,
          LISTS_SPACE,
          viewport,
          LIST_ITEM_SIZE
        );
      }

      await saveItem("listItems", nextItem);
    }

    setItemModalOpen(false);
  }

  async function saveTextCard() {
    const current = collections.boardTexts.find((item) => item.id === textForm.id);
    let nextText = upsertEntity<BoardTextItem>(
      current,
      {
        title: "",
        description: "",
        space: LISTS_SPACE,
        content: textForm.content,
        fontFamily: textForm.fontFamily,
        fontSize: textForm.fontSize,
        textColor: textForm.textColor,
        tone: textForm.tone,
        cornerRadius: textForm.cornerRadius,
      },
      current?.order ?? nextOrder(collections.boardTexts)
    );

    if (!nextText.spacePlacements?.[LISTS_SPACE]) {
      nextText = ensureEntityCenteredInSpace(
        nextText,
        LISTS_SPACE,
        viewport,
        DEFAULT_TEXT_SIZE
      );
    }

    await saveItem("boardTexts", nextText);
    setTextModalOpen(false);
  }

  async function handleItemDrop(overId: string) {
    if (!draggedId || !selectedList || draggedId === overId) {
      return;
    }

    const reordered = moveEntity(listItems, draggedId, overId);
    const untouched = collections.listItems.filter(
      (item) => item.listId !== selectedList.id || item.deletedAt || item.archivedAt
    );
    await saveMany("listItems", [...reordered, ...untouched]);
    setDraggedId(null);
  }

  async function handleFramePlacementCommit(
    list: SmartList,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = framePlacements.get(list.id);

    if (!previousPlacement) {
      return;
    }

    const nextList = setSpacePlacement(list, LISTS_SPACE, placement);
    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;

    const movedItems = collections.listItems.map((item) => {
      if (item.listId !== list.id) {
        return item;
      }

      const itemPlacement = getSpacePlacement(
        item,
        LISTS_SPACE,
        createGridPlacement(0, {
          startX: placement.x + 32,
          startY: placement.y + 84,
          width: 184,
          height: 152,
        })
      );

      return setSpacePlacement(item, LISTS_SPACE, {
        ...itemPlacement,
        x: itemPlacement.x + deltaX,
        y: itemPlacement.y + deltaY,
      });
    });
    const queue: Array<Promise<void>> = [saveItem("lists", nextList)];

    if (deltaX || deltaY) {
      queue.push(saveMany("listItems", movedItems));
    }

    await Promise.all(queue);
  }

  async function handleItemPlacementCommit(
    item: SmartListItem,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const targetFrame = lists
      .map((list) => ({
        list,
        overlap: getPlacementOverlapRatio(
          placement,
          framePlacements.get(list.id) ??
            createGridPlacement(0, {
              startX: 120,
              startY: 120,
              width: 740,
              height: 420,
              gapX: 52,
              gapY: 52,
              columns: 2,
            })
        ),
      }))
      .sort((left, right) => right.overlap - left.overlap)
      .find((entry) => entry.overlap >= 0.5);

    await saveItem(
      "listItems",
      setSpacePlacement(
        {
          ...item,
          listId: targetFrame?.list.id ?? null,
        },
        LISTS_SPACE,
        placement
      )
    );
  }

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
        <div className="pointer-events-auto">
          <Button className="gap-2 rounded-full" onClick={openCreateList}>
            <Plus className="h-4 w-4" />
            {t("createList")}
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
            action={
              <Button onClick={openCreateList} variant="secondary">
                {t("createList")}
              </Button>
            }
            description={t("listsEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "frame") {
            navigate(`/lists/${node.data.list.id}`);
            return;
          }

          if (node.data.kind === "text") {
            openEditText(node.data.text);
            return;
          }

          if (node.data.kind === "item") {
            openEditItem(node.data.item);
          }
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "frame") {
            return [];
          }

          const frameNode = node.data as Extract<ListBoardNodeData, { kind: "frame" }>;

          return activeItems
            .filter((item) => item.listId === frameNode.list.id)
            .map((item) => `item-${item.id}`);
        }}
        onPlacementCommit={(id, placement) => {
          const node = nodes.find((entry) => entry.id === id);

          if (!node) {
            return;
          }

          if (node.data.kind === "frame") {
            void handleFramePlacementCommit(node.data.list, placement);
            return;
          }

          if (node.data.kind === "text") {
            void saveItem("boardTexts", setSpacePlacement(node.data.text, LISTS_SPACE, placement));
            return;
          }

          void handleItemPlacementCommit(node.data.item, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node, options) => {
          if (node.data.kind === "frame") {
            const frame = node.data.list;

            return (
              <ListFrameCard
                itemCount={activeItems.filter((item) => item.listId === frame.id).length}
                isDragging={options.isDragging}
                list={frame}
                placementWidth={node.placement.width}
                onEdit={() => openEditList(frame)}
                onOpen={() => navigate(`/lists/${frame.id}`)}
                onDelete={() =>
                  void Promise.all([
                    saveMany(
                      "listItems",
                      collections.listItems.filter((item) => item.listId !== frame.id)
                    ),
                    hardDelete("lists", frame.id),
                  ])
                }
                onSave={(item) =>
                  void saveItem(
                    "lists",
                    ensureShortcutBoardPlacements(item, settings, FRAME_DEFAULT_SIZE)
                  )
                }
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

          const itemNode = node.data;

          return (
            <ListItemBoardCard
              isLinkedDragging={options.isLinkedDragging}
              item={itemNode.item}
              list={itemNode.list}
              onDelete={() => void hardDelete("listItems", itemNode.item.id)}
              onEdit={() => openEditItem(itemNode.item)}
              onSave={(item) =>
                void saveItem(
                  "listItems",
                  ensureShortcutBoardPlacements(item, settings, LIST_ITEM_SIZE)
                )
              }
            />
          );
        }}
        size={{ width: 4400, height: 2800 }}
        viewport={viewport}
      />

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setListModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveListEntry()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setListModalOpen(false)}
        open={listModalOpen}
        size="lg"
        title={listForm.id ? t("editList") : t("createList")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setListForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderListTitle")}
              value={listForm.title}
            />
          </Field>
          <Field label={t("fieldType")}>
            <Input
              onChange={(event) => setListForm((current) => ({ ...current, listType: event.target.value }))}
              placeholder={t("placeholderListType")}
              value={listForm.listType}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={t("fieldDescription")}>
              <Textarea
                onChange={(event) =>
                  setListForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t("placeholderListDescription")}
                value={listForm.description}
              />
            </Field>
          </div>
          <Field label={t("fieldCoverUrl")}>
            <Input
              onChange={(event) => setListForm((current) => ({ ...current, coverUrl: event.target.value }))}
              placeholder="https://image..."
              value={listForm.coverUrl}
            />
          </Field>
          <Field label={t("fieldAccent")}>
            <Select
              onChange={(event) => setListForm((current) => ({ ...current, accent: event.target.value }))}
              value={listForm.accent}
            >
              {accentOptions.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </Select>
          </Field>
          <Field hint={`${listForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={48}
              min={10}
              onChange={(event) =>
                setListForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={listForm.cornerRadius}
            />
          </Field>
          <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
            {listFeatureOptions.map((feature) => (
              <label
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3"
                key={feature.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--app-text)]">
                      {listFeatureCopy[feature.key].label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--app-muted)]">
                      {listFeatureCopy[feature.key].description}
                    </p>
                  </div>
                  <input
                    checked={listForm.features[feature.key]}
                    onChange={(event) =>
                      setListForm((current) => ({
                        ...current,
                        features: { ...current.features, [feature.key]: event.target.checked },
                      }))
                    }
                    type="checkbox"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setItemModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveItemEntry()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setItemModalOpen(false)}
        open={itemModalOpen}
        size="lg"
        title={itemForm.id ? t("editItem") : t("createItem")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldGroup")}>
            <Select
              onChange={(event) => setItemForm((current) => ({ ...current, listId: event.target.value }))}
              value={itemForm.listId}
            >
              <option value="">{t("selectFrame")}</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderItemTitle")}
              value={itemForm.title}
            />
          </Field>
          <Field hint={`${itemForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={40}
              min={10}
              onChange={(event) =>
                setItemForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={itemForm.cornerRadius}
            />
          </Field>
          {currentItemList?.features.image ? (
            <Field label={t("fieldImageUrl")}>
              <Input
                onChange={(event) => setItemForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://image..."
                value={itemForm.imageUrl}
              />
            </Field>
          ) : null}
          {currentItemList?.features.rating ? (
            <Field label={t("fieldRating")}>
              <Input
                onChange={(event) => setItemForm((current) => ({ ...current, rating: event.target.value }))}
                placeholder="3.5"
                type="number"
                value={itemForm.rating}
              />
            </Field>
          ) : null}
          {currentItemList?.features.description ? (
            <div className="md:col-span-2">
              <Field label={t("fieldDescription")}>
                <Textarea
                  onChange={(event) =>
                    setItemForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={t("placeholderItemDescription")}
                  value={itemForm.description}
                />
              </Field>
            </div>
          ) : null}
          {currentItemList?.features.progress ? (
            <Field label={t("fieldProgress")}>
              <Input
                onChange={(event) => setItemForm((current) => ({ ...current, progress: event.target.value }))}
                placeholder="75"
                type="number"
                value={itemForm.progress}
              />
            </Field>
          ) : null}
          {currentItemList?.features.seasonEpisode ? (
            <>
              <Field label={t("fieldSeason")}>
                <Input
                  onChange={(event) => setItemForm((current) => ({ ...current, season: event.target.value }))}
                  placeholder="1"
                  type="number"
                  value={itemForm.season}
                />
              </Field>
              <Field label={t("fieldEpisode")}>
                <Input
                  onChange={(event) => setItemForm((current) => ({ ...current, episode: event.target.value }))}
                  placeholder="12"
                  type="number"
                  value={itemForm.episode}
                />
              </Field>
            </>
          ) : null}
          {currentItemList?.features.stoppedAt ? (
            <Field label={t("fieldStoppedAt")}>
              <Input
                onChange={(event) => setItemForm((current) => ({ ...current, stoppedAt: event.target.value }))}
                placeholder={t("placeholderStoppedAt")}
                value={itemForm.stoppedAt}
              />
            </Field>
          ) : null}
          {currentItemList?.features.tokenCount ? (
            <Field label={t("fieldTokenCount")}>
              <Input
                onChange={(event) => setItemForm((current) => ({ ...current, tokenCount: event.target.value }))}
                placeholder="120000"
                type="number"
                value={itemForm.tokenCount}
              />
            </Field>
          ) : null}
          {currentItemList?.features.notes ? (
            <div className="md:col-span-2">
              <Field label={t("fieldNotes")}>
                <Textarea
                  onChange={(event) => setItemForm((current) => ({ ...current, itemNotes: event.target.value }))}
                  placeholder={t("placeholderNotes")}
                  value={itemForm.itemNotes}
                />
              </Field>
            </div>
          ) : null}
          {currentItemList?.features.tags ? (
            <div className="md:col-span-2">
              <Field label={t("fieldTags")}>
                <Input
                  onChange={(event) => setItemForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="watchlist, favorite"
                  value={itemForm.tags}
                />
              </Field>
            </div>
          ) : null}
          <div className="md:col-span-2 grid gap-3 md:grid-cols-3">
            {currentItemList?.features.watched ? (
              <label className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
                {t("fieldWatched")}
                <input
                  checked={itemForm.watched}
                  className="mt-3 block"
                  onChange={(event) => setItemForm((current) => ({ ...current, watched: event.target.checked }))}
                  type="checkbox"
                />
              </label>
            ) : null}
            {currentItemList?.features.zeroTokenFlag ? (
              <label className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
                {t("fieldZeroTokens")}
                <input
                  checked={itemForm.zeroToken}
                  className="mt-3 block"
                  onChange={(event) => setItemForm((current) => ({ ...current, zeroToken: event.target.checked }))}
                  type="checkbox"
                />
              </label>
            ) : null}
            {currentItemList?.features.check ? (
              <label className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
                {t("fieldChecked")}
                <input
                  checked={itemForm.checked}
                  className="mt-3 block"
                  onChange={(event) => setItemForm((current) => ({ ...current, checked: event.target.checked }))}
                  type="checkbox"
                />
              </label>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate("/lists")} variant="ghost">
              {t("cancel")}
            </Button>
          </div>
        }
        onClose={() => navigate("/lists")}
        open={!!selectedList}
        size="xl"
        title={selectedList?.title || t("lists")}
      >
        {selectedList ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{selectedList.listType}</Badge>
                  <span className="text-sm text-[var(--app-muted)]">
                    {listItems.length} {t("listItems")}
                  </span>
                </div>
                {selectedList.description ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--app-muted)]">
                    {selectedList.description}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
            <Button onClick={() => openEditList(selectedList)} variant="secondary">
                  {t("edit")}
                </Button>
                <Button className="gap-2" onClick={() => openCreateItem(selectedList.id)}>
                  <Plus className="h-4 w-4" />
                  {t("createItem")}
                </Button>
              </div>
            </div>

            {listItems.length ? (
              <div className="space-y-3">
                {listItems.map((item) => (
                  <div
                    className="rounded-[24px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] p-4"
                    draggable
                    key={item.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedId(item.id)}
                    onDrop={() => void handleItemDrop(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="flex-1 text-left"
                        onClick={() => openEditItem(item)}
                        type="button"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-[var(--app-text)]">
                            {item.title}
                          </p>
                          {selectedList.features.rating && item.rating !== null ? (
                            <Badge>{item.rating.toFixed(1)}</Badge>
                          ) : null}
                          {selectedList.features.check ? (
                            <Badge>{item.checked ? t("fieldChecked") : t("fieldOpenState")}</Badge>
                          ) : null}
                        </div>
                        {selectedList.features.description && item.description ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                            {item.description}
                          </p>
                        ) : null}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditItem(item)}>
                            {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void saveItem("listItems", togglePinned(item))}>
                            {item.pinned ? t("unpin") : t("pin")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void saveItem("listItems", toggleFavorite(item))}>
                            {item.favorite ? t("removeFavorite") : t("favorite")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void hardDelete("listItems", item.id)}>
                            {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <Button onClick={() => openCreateItem(selectedList.id)} variant="secondary">
                    {t("createItem")}
                  </Button>
                }
                description={t("listFrameHint")}
                title=""
              />
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

function ListFrameCard({
  list,
  itemCount,
  placementWidth,
  isDragging,
  onOpen,
  onEdit,
  onSave,
  onDelete,
}: {
  list: SmartList;
  itemCount: number;
  placementWidth: number;
  isDragging: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onSave: (item: SmartList) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <CanvasFrame
      accent={list.accent}
      cornerRadius={list.cornerRadius}
      count={itemCount}
      isDragging={isDragging}
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
            <DropdownMenuItem onClick={onOpen}>{t("open")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(togglePinned(list))}>
              {list.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(list))}>
              {list.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      placementWidth={placementWidth}
      subtitle={list.listType || t("lists")}
      title={list.title}
    />
  );
}

function ListItemBoardCard({
  item,
  list,
  isLinkedDragging,
  onEdit,
  onSave,
  onDelete,
}: {
  item: SmartListItem;
  list: SmartList | null;
  isLinkedDragging: boolean;
  onEdit: () => void;
  onSave: (item: SmartListItem) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className="flex h-full min-h-0 cursor-grab flex-col overflow-hidden border border-[var(--app-border)] bg-[var(--app-panel-strong)] p-3 shadow-[var(--shadow-soft)] active:cursor-grabbing"
      style={{
        borderRadius: item.cornerRadius,
        filter: isLinkedDragging ? "drop-shadow(0 12px 24px rgba(0,0,0,0.18))" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--app-text)]">{item.title}</p>
          <p className="mt-1 truncate text-xs text-[var(--app-muted)]">
            {list?.title || t("lists")}
          </p>
        </div>
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
            <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(togglePinned(item))}>
              {item.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(item))}>
              {item.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        className="mt-3 flex min-h-0 flex-1 flex-col text-left"
        data-space-no-drag="true"
        onClick={onEdit}
        type="button"
      >
        {item.imageUrl ? (
          <img
            alt={item.title}
            className="h-20 w-full rounded-[18px] object-cover"
            draggable={false}
            src={item.imageUrl}
          />
        ) : (
          <div className={`h-20 rounded-[18px] bg-gradient-to-br ${list?.accent ?? "from-zinc-700 to-zinc-900"}`} />
        )}
        <div className="mt-3 min-h-0 overflow-hidden">
          {item.description ? (
            <p className="line-clamp-2 text-xs leading-5 text-[var(--app-muted)]">
              {item.description}
            </p>
          ) : (
            <p className="line-clamp-2 text-xs leading-5 text-[var(--app-muted)]">
              {t("open")}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}
