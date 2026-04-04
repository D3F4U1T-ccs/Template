import { useMemo, useState } from "react";
import { Check, MoreHorizontal, PencilLine, Plus, Rows3, Trash2 } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { SpaceListMode } from "@/components/ui/space-list-mode";
import { Modal } from "@/components/ui/modal";
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
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type {
  BoardTextItem,
  RepeatRule,
  TaskGroup,
  TaskItem,
  TaskPriority,
  WorkspaceSpaceKey,
} from "@/types/models";
import { buildNestedChildIndex, getDescendantGroupIds } from "@/utils/group-tree";
import {
  filterActive,
  getSpacePlacement,
  nextOrder,
  nowIso,
  setSpacePlacement,
  toggleArchive,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_STYLE,
  TASK_GROUP_LAYOUT,
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
import { formatDate } from "@/utils/date";

const TASKS_SPACE: WorkspaceSpaceKey = "tasks-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;
const TASK_TILE_SIZE = {
  width: 308,
  height: 198,
};
const GROUP_DEFAULT_SIZE = {
  width: 760,
  height: 380,
};

type TaskBoardData =
  | {
      kind: "group";
      group: TaskGroup;
      taskCount: number;
    }
  | {
      kind: "task";
      task: TaskItem;
      group: TaskGroup | null;
    }
  | {
      kind: "text";
      text: BoardTextItem;
    };

const emptyTaskForm = {
  id: "",
  title: "",
  description: "",
  priority: "medium" as TaskPriority,
  dueDate: "",
  repeatRule: "none" as RepeatRule,
  tags: "",
  groupId: "",
  cornerRadius: 26,
  pinned: false,
  favorite: false,
};

const emptyGroupForm = {
  id: "",
  title: "",
  description: "",
  parentGroupId: "",
  accent: accentOptions[0],
  cornerRadius: 28,
  collapsed: false,
  pinned: false,
  favorite: false,
};

export default function TasksPage() {
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(TASKS_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);

  const groups = useMemo(
    () => filterActive(collections.taskGroups).filter((item) => !item.archivedAt),
    [collections.taskGroups]
  );
  const tasks = useMemo(
    () =>
      filterActive(collections.tasks).filter(
        (item) => !item.archivedAt && item.taskStatus === "todo"
      ),
    [collections.tasks]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter(
        (item) => item.space === TASKS_SPACE && !item.archivedAt
      ),
    [collections.boardTexts]
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const selectedChildGroups = useMemo(
    () =>
      selectedGroup
        ? groups.filter((group) => group.parentGroupId === selectedGroup.id)
        : [],
    [groups, selectedGroup]
  );
  const selectedGroupTasks = useMemo(
    () =>
      selectedGroup
        ? tasks.filter((task) => task.groupId === selectedGroup.id)
        : [],
    [selectedGroup, tasks]
  );

  const childLayout = useMemo(
    () =>
      buildNestedChildIndex([
        ...groups.map((group) => ({
          key: `group-${group.id}`,
          parentId: group.parentGroupId ?? null,
          order: group.order,
        })),
        ...tasks.map((task) => ({
          key: `task-${task.id}`,
          parentId: task.groupId ?? null,
          order: task.order,
        })),
        ...boardTexts.map((text) => ({
          key: `text-${text.id}`,
          parentId: text.parentGroupId ?? null,
          order: text.order,
        })),
      ]),
    [boardTexts, groups, tasks]
  );

  const groupPlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();
    const rootGroupIndexes = new Map(
      groups
        .filter((group) => !group.parentGroupId)
        .map((group, index) => [group.id, index])
    );

    const resolvePlacement = (
      group: TaskGroup,
      stack = new Set<string>()
    ): ReturnType<typeof createGridPlacement> => {
      const cached = map.get(group.id);

      if (cached) {
        return cached;
      }

      if (stack.has(group.id)) {
        return createGridPlacement(rootGroupIndexes.get(group.id) ?? 0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        });
      }

      const nextStack = new Set(stack).add(group.id);
      const parentGroup = group.parentGroupId
        ? groups.find((entry) => entry.id === group.parentGroupId) ?? null
        : null;
      const siblingIndex = childLayout.indexByKey.get(`group-${group.id}`) ?? 0;
      const fallbackPlacement =
        parentGroup
          ? createContainerPlacement(
              resolvePlacement(parentGroup, nextStack),
              siblingIndex,
              GROUP_DEFAULT_SIZE,
              TASK_GROUP_LAYOUT
            ).placement
          : createGridPlacement(rootGroupIndexes.get(group.id) ?? 0, {
              startX: 120,
              startY: 120,
              width: GROUP_DEFAULT_SIZE.width,
              height: GROUP_DEFAULT_SIZE.height,
              columns: 2,
              gapX: 48,
              gapY: 48,
            });
      const placement = getSpacePlacement(group, TASKS_SPACE, fallbackPlacement);

      map.set(group.id, placement);
      return placement;
    };

    groups.forEach((group) => {
      resolvePlacement(group);
    });

    return map;
  }, [childLayout.indexByKey, groups]);

  const nodes = useMemo<Array<SpaceCanvasNode<TaskBoardData>>>(() => {
    const groupNodes: Array<SpaceCanvasNode<TaskBoardData>> = groups.map((group) => ({
      id: `group-${group.id}`,
      data: {
        kind: "group",
        group,
        taskCount: childLayout.countByParentId.get(group.id) ?? 0,
      },
      placement:
        groupPlacements.get(group.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      resizable: true,
      minSize: {
        width: GROUP_MIN_WIDTH,
        height: GROUP_MIN_HEIGHT,
      },
      zIndex: 5,
    }));

    const taskNodes: Array<SpaceCanvasNode<TaskBoardData>> = tasks.map((task, index) => {
      const parentGroup = task.groupId
        ? groups.find((group) => group.id === task.groupId) ?? null
        : null;
      const siblingIndex = childLayout.indexByKey.get(`task-${task.id}`) ?? 0;
      const parentPlacement = parentGroup
        ? groupPlacements.get(parentGroup.id) ??
          createGridPlacement(0, {
            startX: 120,
            startY: 120,
            width: GROUP_DEFAULT_SIZE.width,
            height: GROUP_DEFAULT_SIZE.height,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        : null;

      const fallbackPlacement = parentGroup && parentPlacement
        ? createContainerPlacement(
            parentPlacement,
            siblingIndex,
            TASK_TILE_SIZE,
            TASK_GROUP_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: TASK_TILE_SIZE.width,
            height: TASK_TILE_SIZE.height,
            columns: 3,
            gapX: 24,
            gapY: 24,
          });

      return {
        id: `task-${task.id}`,
        data: {
          kind: "task",
          task,
          group: parentGroup,
        },
        placement: getSpacePlacement(task, TASKS_SPACE, fallbackPlacement),
        zIndex: 18,
      };
    });

    const textNodes: Array<SpaceCanvasNode<TaskBoardData>> = boardTexts.map((text, index) => {
      const textSize = getBoardTextPlacementSize(text);
      const parentGroup = text.parentGroupId
        ? groups.find((group) => group.id === text.parentGroupId) ?? null
        : null;
      const siblingIndex = childLayout.indexByKey.get(`text-${text.id}`) ?? 0;
      const basePlacement = getSpacePlacement(
        text,
        TASKS_SPACE,
        parentGroup
          ? createContainerPlacement(
              groupPlacements.get(parentGroup.id) ??
                createGridPlacement(0, {
                  startX: 120,
                  startY: 120,
                  width: GROUP_DEFAULT_SIZE.width,
                  height: GROUP_DEFAULT_SIZE.height,
                  columns: 2,
                  gapX: 48,
                  gapY: 48,
                }),
              siblingIndex,
              textSize,
              TASK_GROUP_LAYOUT
            ).placement
          : createGridPlacement(index, {
              startX: 1080,
              startY: 120,
              width: textSize.width,
              height: textSize.height,
              columns: 2,
              gapX: 28,
              gapY: 28,
            })
      );

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

    return [...groupNodes, ...taskNodes, ...textNodes];
  }, [boardTexts, childLayout.countByParentId, childLayout.indexByKey, groupPlacements, groups, tasks]);

  const taskPriorityLabels = useMemo(
    () => ({
      low: t("priorityLow"),
      medium: t("priorityMedium"),
      high: t("priorityHigh"),
      urgent: t("priorityUrgent"),
    }),
    [t]
  );

  const finderItems = useMemo<Array<SpaceObjectFinderItem>>(
    () =>
      nodes.map((node) => {
        if (node.data.kind === "group") {
          return {
            id: node.id,
            title: node.data.group.title,
            subtitle: node.data.group.description || t("tasks"),
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
            subtitle: t("tasks"),
            kindLabel: t("objectTypeText"),
            placement: node.placement,
          };
        }

        return {
          id: node.id,
          title: node.data.task.title,
          subtitle: node.data.task.description || taskPriorityLabels[node.data.task.priority],
          kindLabel: t("objectTypeTask"),
          placement: node.placement,
        };
      }),
    [nodes, t, taskPriorityLabels]
  );

  const getSidePanelGroupId = (groupId: string) => `group-${groupId}`;

  const sidePanelItems: Array<SpaceSidePanelItem> = [
      ...[...groups]
        .sort((left, right) => left.order - right.order)
        .map((group) => ({
          id: getSidePanelGroupId(group.id),
          parentId: group.parentGroupId ? getSidePanelGroupId(group.parentGroupId) : null,
          title: group.title,
          subtitle: group.description || t("tasks"),
          kind: "group" as const,
          accentClassName: group.accent,
          draggable: true,
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
              id: `pin-group-${group.id}`,
              icon: <PencilLine className="h-4 w-4" />,
              label: group.pinned ? t("unpin") : t("pin"),
              onClick: () => {
                void saveItem(
                  "taskGroups",
                  ensureShortcutBoardPlacements(
                    togglePinned(group),
                    settings,
                    GROUP_DEFAULT_SIZE
                  )
                );
              },
            },
            {
              id: `favorite-group-${group.id}`,
              icon: <PencilLine className="h-4 w-4" />,
              label: group.favorite ? t("removeFavorite") : t("favorite"),
              onClick: () => {
                void saveItem(
                  "taskGroups",
                  ensureShortcutBoardPlacements(
                    toggleFavorite(group),
                    settings,
                    GROUP_DEFAULT_SIZE
                  )
                );
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
      ...[...tasks]
        .sort((left, right) => left.order - right.order)
        .map((task) => ({
          id: `task-${task.id}`,
          parentId: task.groupId ? getSidePanelGroupId(task.groupId) : null,
          title: task.title,
          subtitle: task.description || taskPriorityLabels[task.priority],
          kind: "item" as const,
          draggable: true,
          onClick: () => {
            openEditTask(task);
          },
          actions: [
            {
              id: `complete-task-${task.id}`,
              icon: <Check className="h-4 w-4" />,
              label: t("fieldChecked"),
              onClick: () => {
                void completeTask(task);
              },
            },
            {
              id: `pin-task-${task.id}`,
              icon: <PencilLine className="h-4 w-4" />,
              label: task.pinned ? t("unpin") : t("pin"),
              onClick: () => {
                void saveItem(
                  "tasks",
                  ensureShortcutBoardPlacements(togglePinned(task), settings, TASK_TILE_SIZE)
                );
              },
            },
            {
              id: `favorite-task-${task.id}`,
              icon: <PencilLine className="h-4 w-4" />,
              label: task.favorite ? t("removeFavorite") : t("favorite"),
              onClick: () => {
                void saveItem(
                  "tasks",
                  ensureShortcutBoardPlacements(toggleFavorite(task), settings, TASK_TILE_SIZE)
                );
              },
            },
            {
              id: `delete-task-${task.id}`,
              icon: <Trash2 className="h-4 w-4" />,
              label: t("delete"),
              onClick: () => {
                void hardDelete("tasks", task.id);
              },
              tone: "danger" as const,
            },
          ],
        })),
    ];

  async function handleSidePanelMoveTask(
    itemId: string,
    targetGroupPanelId: string | null
  ) {
    const targetGroupId = targetGroupPanelId?.replace(/^group-/, "") ?? null;
    const targetGroup = targetGroupId
      ? groups.find((entry) => entry.id === targetGroupId) ?? null
      : null;

    if (itemId.startsWith("group-")) {
      const groupId = itemId.replace(/^group-/, "");
      const group = groups.find((entry) => entry.id === groupId);

      if (!group || group.parentGroupId === targetGroupId) {
        return;
      }

      const descendantGroupIds = getDescendantGroupIds(groups, group.id);

      if (targetGroupId && (targetGroupId === group.id || descendantGroupIds.includes(targetGroupId))) {
        return;
      }

      const placement = targetGroup
        ? createContainerPlacement(
            groupPlacements.get(targetGroup.id) ??
              createGridPlacement(0, {
                startX: 120,
                startY: 120,
                width: GROUP_DEFAULT_SIZE.width,
                height: GROUP_DEFAULT_SIZE.height,
                columns: 2,
                gapX: 48,
                gapY: 48,
              }),
            (childLayout.keysByParentId.get(targetGroup.id) ?? []).filter(
              (key) => key !== `group-${group.id}`
            ).length,
            GROUP_DEFAULT_SIZE,
            TASK_GROUP_LAYOUT
          ).placement
        : getSpacePlacement(
            ensureEntityCenteredInSpace(group, TASKS_SPACE, viewport, GROUP_DEFAULT_SIZE),
            TASKS_SPACE,
            createGridPlacement(0, {
              startX: 120,
              startY: 120,
              width: GROUP_DEFAULT_SIZE.width,
              height: GROUP_DEFAULT_SIZE.height,
              columns: 2,
              gapX: 48,
              gapY: 48,
            })
          );

      await handleGroupPlacementCommit(group, placement, targetGroupId);
      return;
    }

    const taskId = itemId.replace(/^task-/, "");
    const task = tasks.find((entry) => entry.id === taskId);

    if (!task || task.groupId === targetGroupId) {
      return;
    }

    let nextTask = ensureShortcutBoardPlacements(
      {
        ...task,
        groupId: targetGroupId,
      },
      settings,
      TASK_TILE_SIZE
    );

    if (!targetGroup) {
      nextTask = ensureEntityCenteredInSpace(nextTask, TASKS_SPACE, viewport, TASK_TILE_SIZE);
      await saveItem("tasks", nextTask);
      return;
    }

    const targetPlacement =
      groupPlacements.get(targetGroup.id) ??
      createGridPlacement(0, {
        startX: 120,
        startY: 120,
        width: GROUP_DEFAULT_SIZE.width,
        height: GROUP_DEFAULT_SIZE.height,
        columns: 2,
        gapX: 48,
        gapY: 48,
      });
    const { container, placement } = createContainerPlacement(
      targetPlacement,
      (childLayout.keysByParentId.get(targetGroup.id) ?? []).filter(
        (key) => key !== `task-${nextTask.id}`
      ).length,
      TASK_TILE_SIZE,
      TASK_GROUP_LAYOUT
    );

    nextTask = setSpacePlacement(nextTask, TASKS_SPACE, placement);

    await Promise.all([
      saveItem("tasks", nextTask),
      container.width !== targetPlacement.width || container.height !== targetPlacement.height
        ? saveItem("taskGroups", setSpacePlacement(targetGroup, TASKS_SPACE, container))
        : Promise.resolve(),
    ]);
  }

  function openCreateTask(groupId?: string | null) {
    setTaskForm({
      ...emptyTaskForm,
      groupId: groupId ?? "",
    });
    setTaskModalOpen(true);
  }

  function openEditTask(task: TaskItem) {
    setTaskForm({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      repeatRule: task.repeatRule,
      tags: task.tags.join(", "),
      groupId: task.groupId ?? "",
      cornerRadius: task.cornerRadius,
      pinned: task.pinned,
      favorite: task.favorite,
    });
    setTaskModalOpen(true);
  }

  function openCreateGroup(parentGroupId?: string | null) {
    setGroupForm({
      ...emptyGroupForm,
      parentGroupId: parentGroupId ?? "",
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
    });
    setGroupModalOpen(true);
  }

  function openCreateText() {
    const draftText = upsertEntity<BoardTextItem>(
      undefined,
        {
          title: "",
          description: "",
          space: TASKS_SPACE,
          content: "",
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
          fontSize: DEFAULT_TEXT_STYLE.fontSize,
          textColor: DEFAULT_TEXT_STYLE.textColor,
          backgroundColor: DEFAULT_TEXT_STYLE.backgroundColor,
          tone: DEFAULT_TEXT_STYLE.tone,
          parentGroupId: null,
          cornerRadius: 0,
        },
        nextOrder(collections.boardTexts)
    );
    const nextText = ensureEntityCenteredInSpace(
      draftText,
      TASKS_SPACE,
      viewport,
      getBoardTextPlacementSize(draftText)
    );

    setSelectedTextId(nextText.id);
    void saveItem("boardTexts", nextText);
  }

  function openEditGroup(group: TaskGroup) {
    setSelectedGroupId(null);
    setGroupForm({
      id: group.id,
      title: group.title,
      description: group.description,
      parentGroupId: group.parentGroupId ?? "",
      accent: group.accent,
      cornerRadius: group.cornerRadius,
      collapsed: group.collapsed,
      pinned: group.pinned,
      favorite: group.favorite,
    });
    setGroupModalOpen(true);
  }

  async function saveTask() {
    const existing = collections.tasks.find((item) => item.id === taskForm.id);
    let task = upsertEntity<TaskItem>(
      existing,
      {
        title: taskForm.title.trim() || t("untitledTask"),
        description: taskForm.description,
        groupId: taskForm.groupId || null,
        priority: taskForm.priority,
        taskStatus: "todo",
        taskType: existing?.taskType ?? (taskForm.repeatRule !== "none" ? "recurring" : "day"),
        dueDate: taskForm.dueDate || null,
        repeatRule: taskForm.repeatRule,
        completed: false,
        moveToTomorrow: false,
        cornerRadius: taskForm.cornerRadius,
        tags: taskForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        pinned: taskForm.pinned,
        favorite: taskForm.favorite,
      },
      existing?.order ?? nextOrder(collections.tasks)
    );

    task = ensureShortcutBoardPlacements(task, settings, TASK_TILE_SIZE);
    const targetGroup = task.groupId
      ? groups.find((group) => group.id === task.groupId) ?? null
      : null;

    if (targetGroup && (!existing || existing.groupId !== task.groupId)) {
      const targetGroupPlacement =
        groupPlacements.get(targetGroup.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        });
      const { container, placement } = createContainerPlacement(
        targetGroupPlacement,
        (childLayout.keysByParentId.get(targetGroup.id) ?? []).filter(
          (key) => key !== `task-${task.id}`
        ).length,
        TASK_TILE_SIZE,
        TASK_GROUP_LAYOUT
      );

      task = setSpacePlacement(task, TASKS_SPACE, placement);

      await Promise.all([
        saveItem("tasks", task),
        container.width !== targetGroupPlacement.width ||
        container.height !== targetGroupPlacement.height
          ? saveItem("taskGroups", setSpacePlacement(targetGroup, TASKS_SPACE, container))
          : Promise.resolve(),
      ]);
    } else {
      if (!task.spacePlacements?.[TASKS_SPACE] && !task.groupId) {
        task = ensureEntityCenteredInSpace(task, TASKS_SPACE, viewport, TASK_TILE_SIZE);
      }

      await saveItem("tasks", task);
    }

    setTaskModalOpen(false);
    pushToast({
      title: existing ? t("edit") : t("createTask"),
      description: t("taskSaved"),
      tone: "success",
    });
  }

  async function saveGroup() {
    const current = collections.taskGroups.find((item) => item.id === groupForm.id);
    let nextGroup = upsertEntity<TaskGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        parentGroupId: groupForm.parentGroupId || null,
        accent: groupForm.accent,
        cornerRadius: groupForm.cornerRadius,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.taskGroups)
    );

    nextGroup = ensureShortcutBoardPlacements(nextGroup, settings, GROUP_DEFAULT_SIZE);

    const targetParent = nextGroup.parentGroupId
      ? groups.find((group) => group.id === nextGroup.parentGroupId) ?? null
      : null;

    if (targetParent) {
      const targetPlacement =
        groupPlacements.get(targetParent.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        });
      const { container, placement } = createContainerPlacement(
        targetPlacement,
        (childLayout.keysByParentId.get(targetParent.id) ?? []).filter(
          (key) => key !== `group-${nextGroup.id}`
        ).length,
        GROUP_DEFAULT_SIZE,
        TASK_GROUP_LAYOUT
      );

      nextGroup = setSpacePlacement(nextGroup, TASKS_SPACE, placement);

      await Promise.all([
        saveItem("taskGroups", nextGroup),
        container.width !== targetPlacement.width || container.height !== targetPlacement.height
          ? saveItem("taskGroups", setSpacePlacement(targetParent, TASKS_SPACE, container))
          : Promise.resolve(),
      ]);
    } else {
      if (!nextGroup.spacePlacements?.[TASKS_SPACE]) {
        nextGroup = ensureEntityCenteredInSpace(
          nextGroup,
          TASKS_SPACE,
          viewport,
          GROUP_DEFAULT_SIZE
        );
      }

      await saveItem("taskGroups", nextGroup);
    }
    setGroupModalOpen(false);
  }

  async function completeTask(task: TaskItem) {
    await saveItem("tasks", {
      ...task,
      completed: true,
      taskStatus: "done",
      updatedAt: nowIso(),
    });
  }

  async function deleteGroup(group: TaskGroup) {
    await Promise.all([
      saveMany(
        "tasks",
        collections.tasks.map((task) =>
          task.groupId === group.id ? { ...task, groupId: group.parentGroupId ?? null } : task
        )
      ),
      saveMany(
        "boardTexts",
        collections.boardTexts.map((text) =>
          text.space === TASKS_SPACE && text.parentGroupId === group.id
            ? { ...text, parentGroupId: group.parentGroupId ?? null }
            : text
        )
      ),
      saveMany(
        "taskGroups",
        collections.taskGroups.map((entry) =>
          entry.parentGroupId === group.id
            ? { ...entry, parentGroupId: group.parentGroupId ?? null }
            : entry
        )
      ),
      hardDelete("taskGroups", group.id),
    ]);
    setSelectedGroupId((current) => (current === group.id ? null : current));
  }

  async function handleGroupPlacementCommit(
    group: TaskGroup,
    placement: ReturnType<typeof createGridPlacement>,
    forcedTargetGroupId?: string | null
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    const descendantGroupIds = getDescendantGroupIds(groups, group.id);
    const blockedGroupIds = new Set([group.id, ...descendantGroupIds]);
    const targetGroup =
      forcedTargetGroupId === undefined
        ? getInnermostContainingEntry(
            placement,
            groups.filter((entry) => !blockedGroupIds.has(entry.id)),
            (entry) =>
              groupPlacements.get(entry.id) ??
              createGridPlacement(0, {
                startX: 120,
                startY: 120,
                width: 760,
                height: 380,
                columns: 2,
                gapX: 48,
                gapY: 48,
              }),
            18
          )
        : forcedTargetGroupId
          ? groups.find(
              (entry) =>
                entry.id === forcedTargetGroupId && !blockedGroupIds.has(entry.id)
            ) ?? null
          : null;

    let nextPlacement = placement;
    const changedGroups = new Map<string, TaskGroup>();

    if (targetGroup && targetGroup.id !== group.parentGroupId) {
      const targetPlacement =
        groupPlacements.get(targetGroup.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        });
      const { container, placement: nestedPlacement } = createContainerPlacement(
        targetPlacement,
        (childLayout.keysByParentId.get(targetGroup.id) ?? []).filter(
          (key) => key !== `group-${group.id}`
        ).length,
        GROUP_DEFAULT_SIZE,
        TASK_GROUP_LAYOUT
      );

      nextPlacement = nestedPlacement;

      if (container.width !== targetPlacement.width || container.height !== targetPlacement.height) {
        changedGroups.set(targetGroup.id, setSpacePlacement(targetGroup, TASKS_SPACE, container));
      }
    }

    const deltaX = nextPlacement.x - previousPlacement.x;
    const deltaY = nextPlacement.y - previousPlacement.y;
    const movedTasks = collections.tasks
      .filter((task) => task.groupId === group.id || descendantGroupIds.includes(task.groupId ?? ""))
      .map((task) => {
        const taskPlacement = getSpacePlacement(
          task,
          TASKS_SPACE,
          createGridPlacement(0, {
            startX: nextPlacement.x + 28,
            startY: nextPlacement.y + 84,
            width: 308,
            height: 198,
          })
        );

        return setSpacePlacement(task, TASKS_SPACE, {
          ...taskPlacement,
          x: taskPlacement.x + deltaX,
          y: taskPlacement.y + deltaY,
        });
      });
    const movedTexts = collections.boardTexts
      .filter(
        (text) =>
          text.space === TASKS_SPACE &&
          (text.parentGroupId === group.id || descendantGroupIds.includes(text.parentGroupId ?? ""))
      )
      .map((text) => {
        const textPlacement = getSpacePlacement(
          text,
          TASKS_SPACE,
          createGridPlacement(0, {
            startX: nextPlacement.x + 28,
            startY: nextPlacement.y + 84,
            width: 320,
            height: 120,
          })
        );

        return setSpacePlacement(text, TASKS_SPACE, {
          ...textPlacement,
          x: textPlacement.x + deltaX,
          y: textPlacement.y + deltaY,
        });
      });
    const movedGroups = groups
      .filter((entry) => descendantGroupIds.includes(entry.id))
      .map((entry) => {
        const groupPlacement =
          groupPlacements.get(entry.id) ??
          createGridPlacement(0, {
            startX: nextPlacement.x + 28,
            startY: nextPlacement.y + 84,
            width: GROUP_DEFAULT_SIZE.width,
            height: GROUP_DEFAULT_SIZE.height,
          });

        return setSpacePlacement(entry, TASKS_SPACE, {
          ...groupPlacement,
          x: groupPlacement.x + deltaX,
          y: groupPlacement.y + deltaY,
        });
      });

    changedGroups.set(
      group.id,
      setSpacePlacement(
        {
          ...group,
          parentGroupId: targetGroup?.id ?? null,
        },
        TASKS_SPACE,
        nextPlacement
      )
    );
    movedGroups.forEach((entry) => changedGroups.set(entry.id, entry));

    await Promise.all([
      saveMany(
        "taskGroups",
        collections.taskGroups.map((entry) => changedGroups.get(entry.id) ?? entry)
      ),
      deltaX || deltaY
        ? saveMany(
            "tasks",
            collections.tasks.map(
              (entry) => movedTasks.find((changed) => changed.id === entry.id) ?? entry
            )
          )
        : Promise.resolve(),
      deltaX || deltaY
        ? saveMany(
            "boardTexts",
            collections.boardTexts.map(
              (entry) => movedTexts.find((changed) => changed.id === entry.id) ?? entry
            )
          )
        : Promise.resolve(),
    ]);
  }

  async function handleTaskPlacementCommit(
    task: TaskItem,
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
          width: 760,
          height: 380,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      18
    );

    await saveItem(
      "tasks",
      setSpacePlacement(
        {
          ...task,
          groupId: targetGroup?.id ?? null,
        },
        TASKS_SPACE,
        placement
      )
    );
  }

  async function handleTextPlacementCommit(
    text: BoardTextItem,
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
          width: 760,
          height: 380,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      18
    );

    await saveItem(
      "boardTexts",
      setSpacePlacement(
        {
          ...text,
          parentGroupId: targetGroup?.id ?? null,
        },
        TASKS_SPACE,
        placement
      )
    );
  }

  return (
    <div className="relative h-full">
      {!listMode ? (
        <SpaceSidePanel
          actions={
            <>
              <Button className="rounded-full" onClick={() => openCreateGroup()} variant="secondary">
                {t("createGroup")}
              </Button>
              <Button className="rounded-full" onClick={() => openCreateTask()}>
                {t("createTask")}
              </Button>
            </>
          }
          items={sidePanelItems}
          onMoveItem={(itemId, targetGroupId) => {
            void handleSidePanelMoveTask(itemId, targetGroupId);
          }}
          title={t("tasks")}
        />
      ) : null}

      {!listMode ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
          <div className="pointer-events-auto">
            <Button className="rounded-full" onClick={() => openCreateGroup()} variant="secondary">
              {t("createGroup")}
            </Button>
          </div>
          <div className="pointer-events-auto">
            <Button className="rounded-full" onClick={openCreateText} variant="secondary">
              {t("createText")}
            </Button>
          </div>
          <div className="pointer-events-auto">
            <Button className="gap-2 rounded-full" onClick={() => openCreateTask()}>
              <Plus className="h-4 w-4" />
              {t("createTask")}
            </Button>
          </div>
        </div>
      ) : null}

      {listMode ? (
        <SpaceListMode
          actions={
            <>
              <Button className="rounded-full" onClick={() => openCreateGroup()} variant="secondary">
                {t("createGroup")}
              </Button>
              <Button className="rounded-full" onClick={() => openCreateTask()}>
                {t("createTask")}
              </Button>
            </>
          }
          items={sidePanelItems}
          onExit={() => setListMode(false)}
          onMoveItem={(itemId, targetGroupId) => {
            void handleSidePanelMoveTask(itemId, targetGroupId);
          }}
          title={t("tasks")}
        />
      ) : (
        <SpaceCanvas
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        emptyState={
          <EmptyState
            action={
              <Button onClick={() => openCreateTask()} variant="secondary">
                {t("createTask")}
              </Button>
            }
            description={t("tasksEmpty")}
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

          if (node.data.kind === "task") {
            setSelectedTextId(null);
            openEditTask(node.data.task);
          }
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "group") {
            return [];
          }

          const groupNode = node.data as Extract<TaskBoardData, { kind: "group" }>;
          const descendantGroupIds = getDescendantGroupIds(groups, groupNode.group.id);

          return [
            ...groups
              .filter((group) => descendantGroupIds.includes(group.id))
              .map((group) => `group-${group.id}`),
            ...tasks
              .filter(
                (task) =>
                  task.groupId === groupNode.group.id ||
                  descendantGroupIds.includes(task.groupId ?? "")
              )
              .map((task) => `task-${task.id}`),
            ...boardTexts
              .filter(
                (text) =>
                  text.parentGroupId === groupNode.group.id ||
                  descendantGroupIds.includes(text.parentGroupId ?? "")
              )
              .map((text) => `text-${text.id}`),
          ];
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
            void handleTextPlacementCommit(node.data.text, placement);
            return;
          }

          void handleTaskPlacementCommit(node.data.task, placement);
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
              <TaskFrameCard
                group={groupNode.group}
                isDragging={options.isDragging}
                placementWidth={node.placement.width}
                taskCount={groupNode.taskCount}
                onEdit={() => openEditGroup(groupNode.group)}
                onDelete={() => void deleteGroup(groupNode.group)}
                onSave={(item) =>
                  void saveItem(
                    "taskGroups",
                    ensureShortcutBoardPlacements(item, settings, GROUP_DEFAULT_SIZE)
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

          const taskNode = node.data;

          return (
            <TaskBoardCard
              onDelete={() => void hardDelete("tasks", taskNode.task.id)}
              onComplete={() => void completeTask(taskNode.task)}
              onEdit={() => openEditTask(taskNode.task)}
              onSave={(item) =>
                void saveItem(
                  "tasks",
                  ensureShortcutBoardPlacements(item, settings, TASK_TILE_SIZE)
                )
              }
              task={taskNode.task}
            />
          );
        }}
        size={{ width: 4600, height: 2800 }}
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
            <Button onClick={() => setTaskModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveTask()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setTaskModalOpen(false)}
        open={taskModalOpen}
        title={taskForm.id ? t("edit") : t("createTask")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder={t("placeholderItemTitle")}
              value={taskForm.title}
            />
          </Field>
          <Field label={t("fieldGroup")}>
            <Select
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, groupId: event.target.value }))
              }
              value={taskForm.groupId}
            >
              <option value="">{t("noGroup")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field hint={`${taskForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={40}
              min={10}
              onChange={(event) =>
                setTaskForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={taskForm.cornerRadius}
            />
          </Field>
          <Field label={t("fieldPriority")}>
            <Select
              onChange={(event) =>
                setTaskForm((current) => ({
                  ...current,
                  priority: event.target.value as TaskPriority,
                }))
              }
              value={taskForm.priority}
            >
              <option value="low">{t("priorityLow")}</option>
              <option value="medium">{t("priorityMedium")}</option>
              <option value="high">{t("priorityHigh")}</option>
              <option value="urgent">{t("priorityUrgent")}</option>
            </Select>
          </Field>
          <Field label={t("fieldRepeat")}>
            <Select
              onChange={(event) =>
                setTaskForm((current) => ({
                  ...current,
                  repeatRule: event.target.value as RepeatRule,
                }))
              }
              value={taskForm.repeatRule}
            >
              <option value="none">{t("repeatNone")}</option>
              <option value="daily">{t("repeatDaily")}</option>
              <option value="weekly">{t("repeatWeekly")}</option>
              <option value="monthly">{t("repeatMonthly")}</option>
            </Select>
          </Field>
          <Field label={t("fieldDeadline")}>
            <Input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
              }
              type="date"
              value={taskForm.dueDate}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={t("fieldDescription")}>
              <Textarea
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t("placeholderItemDescription")}
                value={taskForm.description}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t("fieldTags")}>
              <Input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="work, focus, admin"
                value={taskForm.tags}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setGroupModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveGroup()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setGroupModalOpen(false)}
        open={groupModalOpen}
        title={groupForm.id ? t("edit") : t("createGroup")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder={t("placeholderListTitle")}
              value={groupForm.title}
            />
          </Field>
          <Field label={t("fieldAccent")}>
            <Select
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, accent: event.target.value }))
              }
              value={groupForm.accent}
            >
              {accentOptions.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            {selectedGroup ? (
              <Button
                className="gap-2"
                onClick={() => openCreateGroup(selectedGroup.id)}
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                {t("createGroup")}
              </Button>
            ) : null}
            {selectedGroup ? (
              <Button
                className="gap-2"
                onClick={() => openCreateTask(selectedGroup.id)}
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                {t("createTask")}
              </Button>
            ) : null}
            <Button onClick={() => setSelectedGroupId(null)}>{t("cancel")}</Button>
          </div>
        }
        onClose={() => setSelectedGroupId(null)}
        open={!!selectedGroup}
        size="lg"
        title={selectedGroup?.title || t("createGroup")}
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
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(
                        "taskGroups",
                        ensureShortcutBoardPlacements(
                          togglePinned(selectedGroup),
                          settings,
                          GROUP_DEFAULT_SIZE
                        )
                      )
                    }
                  >
                    {selectedGroup.pinned ? t("unpin") : t("pin")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(
                        "taskGroups",
                        ensureShortcutBoardPlacements(
                          toggleFavorite(selectedGroup),
                          settings,
                          GROUP_DEFAULT_SIZE
                        )
                      )
                    }
                  >
                    {selectedGroup.favorite ? t("removeFavorite") : t("favorite")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void deleteGroup(selectedGroup)}>
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {selectedChildGroups.length ? (
              <div className="space-y-3">
                {selectedChildGroups.map((group) => (
                  <button
                    className="flex w-full items-start justify-between rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--app-text)]">{group.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--app-muted)]">
                        {group.description || t("tasks")}
                      </p>
                    </div>
                    <Badge>{t("objectTypeGroup")}</Badge>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedGroupTasks.length ? (
              <div className="space-y-3">
                {selectedGroupTasks.map((task) => (
                  <button
                    className="flex w-full items-start justify-between rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                    key={task.id}
                    onClick={() => openEditTask(task)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--app-text)]">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--app-muted)]">
                        {task.description || task.priority}
                      </p>
                    </div>
                    <Badge>{task.priority}</Badge>
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

function TaskBoardCard({
  task,
  onEdit,
  onSave,
  onComplete,
  onDelete,
}: {
  task: TaskItem;
  onEdit: () => void;
  onSave: (item: TaskItem) => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const priorityLabelMap = {
    low: t("priorityLow"),
    medium: t("priorityMedium"),
    high: t("priorityHigh"),
    urgent: t("priorityUrgent"),
  } as const;
  const repeatLabelMap = {
    none: t("repeatNone"),
    daily: t("repeatDaily"),
    weekly: t("repeatWeekly"),
    monthly: t("repeatMonthly"),
  } as const;

  return (
    <div
      className="flex h-full cursor-grab flex-col border border-[var(--app-border)] bg-[var(--app-panel-strong)] p-4 shadow-[var(--shadow-soft)] active:cursor-grabbing"
      style={{ borderRadius: task.cornerRadius }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-text)]"
          data-space-no-drag="true"
          onClick={onComplete}
          type="button"
        >
          <Check className="h-4 w-4" />
        </button>
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
            <DropdownMenuItem onClick={() => onSave(togglePinned(task))}>
              {task.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(task))}>
              {task.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex-1">
        <p className="text-lg font-semibold text-[var(--app-text)]">{task.title}</p>
        {task.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--app-muted)]">
            {task.description}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" data-space-no-drag="true">
        <Badge>{priorityLabelMap[task.priority]}</Badge>
        {task.repeatRule !== "none" ? <Badge>{repeatLabelMap[task.repeatRule]}</Badge> : null}
        {task.dueDate ? <Badge>{formatDate(task.dueDate)}</Badge> : null}
      </div>
    </div>
  );
}

function TaskFrameCard({
  group,
  taskCount,
  placementWidth,
  isDragging,
  onEdit,
  onSave,
  onDelete,
}: {
  group: TaskGroup;
  taskCount: number;
  placementWidth: number;
  isDragging: boolean;
  onEdit: () => void;
  onSave: (item: TaskGroup) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <CanvasFrame
      accent={group.accent}
      cornerRadius={group.cornerRadius}
      count={taskCount}
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
            <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(togglePinned(group))}>
              {group.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(group))}>
              {group.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      placementWidth={placementWidth}
      subtitle={group.description || t("tasks")}
      title={group.title}
    />
  );
}
