import { useMemo, useState } from "react";
import { Check, MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { Modal } from "@/components/ui/modal";
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
import {
  filterActive,
  getSpacePlacement,
  nextOrder,
  nowIso,
  setSpacePlacement,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_STYLE,
  TASK_GROUP_LAYOUT,
  createContainerPlacement,
  ensureEntityCenteredInSpace,
  getFontSizeFromResize,
  ensureShortcutBoardPlacements,
} from "@/utils/board";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";
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
      filterActive(collections.boardTexts).filter((item) => item.space === TASKS_SPACE),
    [collections.boardTexts]
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const selectedGroupTasks = useMemo(
    () =>
      selectedGroup
        ? tasks.filter((task) => task.groupId === selectedGroup.id)
        : [],
    [selectedGroup, tasks]
  );

  const groupPlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();

    groups.forEach((group, index) => {
      map.set(
        group.id,
        getSpacePlacement(
          group,
          TASKS_SPACE,
          createGridPlacement(index, {
            startX: 120,
            startY: 120,
            width: GROUP_DEFAULT_SIZE.width,
            height: GROUP_DEFAULT_SIZE.height,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        )
      );
    });

    return map;
  }, [groups]);

  const nodes = useMemo<Array<SpaceCanvasNode<TaskBoardData>>>(() => {
    const groupNodes: Array<SpaceCanvasNode<TaskBoardData>> = groups.map((group) => ({
      id: `group-${group.id}`,
      data: {
        kind: "group",
        group,
        taskCount: tasks.filter((task) => task.groupId === group.id).length,
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

    const groupedTasks = new Map<string | null, TaskItem[]>();

    tasks.forEach((task) => {
      const bucket = groupedTasks.get(task.groupId) ?? [];
      bucket.push(task);
      groupedTasks.set(task.groupId, bucket);
    });

    const taskNodes: Array<SpaceCanvasNode<TaskBoardData>> = tasks.map((task, index) => {
      const parentGroup = task.groupId
        ? groups.find((group) => group.id === task.groupId) ?? null
        : null;
      const siblingIndex = (groupedTasks.get(task.groupId) ?? []).findIndex(
        (entry) => entry.id === task.id
      );
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

    const textNodes: Array<SpaceCanvasNode<TaskBoardData>> = boardTexts.map((text, index) => ({
      id: `text-${text.id}`,
      data: {
        kind: "text",
        text,
      },
      placement: getSpacePlacement(
        text,
        TASKS_SPACE,
        createGridPlacement(index, {
          startX: 1080,
          startY: 120,
          width: DEFAULT_TEXT_SIZE.width,
          height: DEFAULT_TEXT_SIZE.height,
          columns: 2,
          gapX: 28,
          gapY: 28,
        })
      ),
      resizable: true,
      resizeMode: "font-size",
      minSize: {
        width: 220,
        height: 120,
      },
      zIndex: 60,
    }));

    return [...groupNodes, ...taskNodes, ...textNodes];
  }, [boardTexts, groupPlacements, groups, tasks]);

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

  function openCreateGroup() {
    setGroupForm({
      ...emptyGroupForm,
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
    });
    setGroupModalOpen(true);
  }

  function openCreateText() {
    const nextText = ensureEntityCenteredInSpace(
      upsertEntity<BoardTextItem>(
        undefined,
        {
          title: "",
          description: "",
          space: TASKS_SPACE,
          content: "",
          fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
          fontSize: DEFAULT_TEXT_STYLE.fontSize,
          textColor: DEFAULT_TEXT_STYLE.textColor,
          tone: DEFAULT_TEXT_STYLE.tone,
          cornerRadius: 0,
        },
        nextOrder(collections.boardTexts)
      ),
      TASKS_SPACE,
      viewport,
      DEFAULT_TEXT_SIZE
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
      const siblingCount = tasks.filter(
        (entry) => entry.groupId === targetGroup.id && entry.id !== task.id
      ).length;
      const { container, placement } = createContainerPlacement(
        targetGroupPlacement,
        siblingCount,
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
        accent: groupForm.accent,
        cornerRadius: groupForm.cornerRadius,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.taskGroups)
    );

    nextGroup = ensureShortcutBoardPlacements(nextGroup, settings, GROUP_DEFAULT_SIZE);

    if (!nextGroup.spacePlacements?.[TASKS_SPACE]) {
      nextGroup = ensureEntityCenteredInSpace(
        nextGroup,
        TASKS_SPACE,
        viewport,
        GROUP_DEFAULT_SIZE
      );
    }

    await saveItem("taskGroups", nextGroup);
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
          task.groupId === group.id ? { ...task, groupId: null } : task
        )
      ),
      hardDelete("taskGroups", group.id),
    ]);
    setSelectedGroupId((current) => (current === group.id ? null : current));
  }

  async function handleGroupPlacementCommit(
    group: TaskGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;
    const movedTasks = collections.tasks
      .filter((task) => task.groupId === group.id)
      .map((task) => {
        const taskPlacement = getSpacePlacement(
          task,
          TASKS_SPACE,
          createGridPlacement(0, {
            startX: placement.x + 28,
            startY: placement.y + 84,
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
    const queue: Array<Promise<void>> = [
      saveItem("taskGroups", setSpacePlacement(group, TASKS_SPACE, placement)),
    ];

    if (deltaX || deltaY) {
      const untouchedTasks = collections.tasks.filter((task) => task.groupId !== group.id);
      queue.push(saveMany("tasks", [...untouchedTasks, ...movedTasks]));
    }

    await Promise.all(queue);
  }

  async function handleTaskPlacementCommit(
    task: TaskItem,
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
              width: 760,
              height: 380,
              columns: 2,
              gapX: 48,
              gapY: 48,
            })
        ),
      }))
      .sort((left, right) => right.overlap - left.overlap)
      .find((entry) => entry.overlap >= 0.5);

    await saveItem(
      "tasks",
      setSpacePlacement(
        {
          ...task,
          groupId: targetGroup?.group.id ?? null,
        },
        TASKS_SPACE,
        placement
      )
    );
  }

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
        <div className="pointer-events-auto">
          <Button className="rounded-full" onClick={openCreateGroup} variant="secondary">
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
            setSelectedGroupId(node.data.group.id);
            return;
          }

          if (node.data.kind === "text") {
            setSelectedTextId(node.data.text.id);
            return;
          }

          if (node.data.kind === "task") {
            openEditTask(node.data.task);
          }
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "group") {
            return [];
          }

          const groupNode = node.data as Extract<TaskBoardData, { kind: "group" }>;

          return tasks
            .filter((task) => task.groupId === groupNode.group.id)
            .map((task) => `task-${task.id}`);
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
            setSelectedTextId(node.data.text.id);
            void saveItem("boardTexts", setSpacePlacement(node.data.text, TASKS_SPACE, placement));
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

          setSelectedTextId(text.id);
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
                onSave={(patch) =>
                  void saveItem("boardTexts", {
                    ...textNode.text,
                    ...patch,
                  })
                }
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
