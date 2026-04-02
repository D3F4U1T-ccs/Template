import { useMemo, useState, type ReactNode } from "react";
import { Check, MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
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
  RepeatRule,
  TaskGroup,
  TaskItem,
  TaskPriority,
  WorkspaceSpaceKey,
} from "@/types/models";
import {
  filterActive,
  getSpacePlacement,
  markDeleted,
  nextOrder,
  nowIso,
  setSpacePlacement,
  toggleArchive,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";
import { formatDate } from "@/utils/date";

const TASKS_SPACE: WorkspaceSpaceKey = "tasks-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;

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
  pinned: false,
  favorite: false,
};

const emptyGroupForm = {
  id: "",
  title: "",
  description: "",
  accent: accentOptions[0],
  collapsed: false,
  pinned: false,
  favorite: false,
};

export default function TasksPage() {
  const { collections, saveItem, saveMany } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(TASKS_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
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
            width: 760,
            height: 380,
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
          width: 760,
          height: 380,
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
            width: 760,
            height: 380,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        : null;

      const fallbackPlacement = parentGroup && parentPlacement
        ? {
            x: parentPlacement.x + 28 + (siblingIndex % 2) * 336,
            y: parentPlacement.y + 84 + Math.floor(siblingIndex / 2) * 226,
            width: 308,
            height: 198,
          }
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: 308,
            height: 198,
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

    return [...groupNodes, ...taskNodes];
  }, [groupPlacements, groups, tasks]);

  function openCreateTask() {
    setTaskForm(emptyTaskForm);
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

  function openEditGroup(group: TaskGroup) {
    setGroupForm({
      id: group.id,
      title: group.title,
      description: group.description,
      accent: group.accent,
      collapsed: group.collapsed,
      pinned: group.pinned,
      favorite: group.favorite,
    });
    setGroupModalOpen(true);
  }

  async function saveTask() {
    const existing = collections.tasks.find((item) => item.id === taskForm.id);
    const task = upsertEntity<TaskItem>(
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
        tags: taskForm.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        pinned: taskForm.pinned,
        favorite: taskForm.favorite,
      },
      existing?.order ?? nextOrder(collections.tasks)
    );

    await saveItem("tasks", task);
    setTaskModalOpen(false);
    pushToast({
      title: existing ? t("edit") : t("createTask"),
      description: t("taskSaved"),
      tone: "success",
    });
  }

  async function saveGroup() {
    const current = collections.taskGroups.find((item) => item.id === groupForm.id);
    const nextGroup = upsertEntity<TaskGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        accent: groupForm.accent,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.taskGroups)
    );

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

  async function handleGroupPlacementCommit(
    group: TaskGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    await saveItem("taskGroups", setSpacePlacement(group, TASKS_SPACE, placement));

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;

    if (!deltaX && !deltaY) {
      return;
    }

    const movedTasks = tasks
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

    if (!movedTasks.length) {
      return;
    }

    const untouchedTasks = collections.tasks.filter((task) => task.groupId !== group.id);
    await saveMany("tasks", [...untouchedTasks, ...movedTasks]);
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
          <Button className="gap-2 rounded-full" onClick={openCreateTask}>
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
              <Button onClick={openCreateTask} variant="secondary">
                {t("createTask")}
              </Button>
            }
            description={t("tasksEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "task") {
            openEditTask(node.data.task);
          }
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

          void handleTaskPlacementCommit(node.data.task, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <TaskFrameCard
                group={groupNode.group}
                taskCount={groupNode.taskCount}
                onEdit={() => openEditGroup(groupNode.group)}
                onSave={(item) => void saveItem("taskGroups", item)}
              />
            );
          }

          const taskNode = node.data;

          return (
            <TaskBoardCard
              onComplete={() => void completeTask(taskNode.task)}
              onEdit={() => openEditTask(taskNode.task)}
              onSave={(item) => void saveItem("tasks", item)}
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
    </div>
  );
}

function TaskBoardCard({
  task,
  onEdit,
  onSave,
  onComplete,
}: {
  task: TaskItem;
  onEdit: () => void;
  onSave: (item: TaskItem) => void;
  onComplete: () => void;
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
    <div className="flex h-full cursor-grab flex-col rounded-[26px] border border-[var(--app-border)] bg-[var(--app-panel-strong)] p-4 shadow-[var(--shadow-soft)] active:cursor-grabbing">
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
            <DropdownMenuItem onClick={() => onSave(toggleArchive(task))}>
              {task.archivedAt ? t("restore") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(markDeleted(task))}>
              {t("delete")}
            </DropdownMenuItem>
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
  onEdit,
  onSave,
}: {
  group: TaskGroup;
  taskCount: number;
  onEdit: () => void;
  onSave: (item: TaskGroup) => void;
}) {
  const { t } = useI18n();

  return (
    <FrameSurface accent={group.accent}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-white">{group.title}</p>
          {group.description ? (
            <p className="mt-1 truncate text-sm text-white/50">{group.description}</p>
          ) : null}
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
            <DropdownMenuItem onClick={() => onSave(toggleArchive(group))}>
              {group.archivedAt ? t("restore") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(markDeleted(group))}>
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mt-5 flex-1 rounded-[24px] border border-white/10 bg-black/72" />

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-white/52">{t("listFrameHint")}</span>
        <Badge className="border-white/10 bg-white/5 text-white/70">{taskCount}</Badge>
      </div>
    </FrameSurface>
  );
}

function FrameSurface({
  accent,
  children,
}: {
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative flex h-full min-h-0 cursor-grab flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/85 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] active:cursor-grabbing">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-25 transition-opacity duration-200 group-hover:opacity-35`}
      />
      {children}
    </div>
  );
}
