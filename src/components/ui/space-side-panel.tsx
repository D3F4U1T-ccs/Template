import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  CornerUpLeft,
  ChevronRight,
  FolderOpen,
  FolderInput,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

import { SearchField } from "@/components/ui/primitives";
import { useI18n } from "@/data/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { debugSpaceEvent } from "@/utils/space-debug";

export type SpaceSidePanelAction = {
  id: string;
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  children?: SpaceSidePanelAction[];
  disabled?: boolean;
  tone?: "default" | "danger";
};

export type SpaceSidePanelItem = {
  id: string;
  parentId?: string | null;
  title: string;
  subtitle?: string;
  kind: "group" | "item";
  accentClassName?: string;
  previewImageUrl?: string;
  previewLabel?: string;
  onClick?: () => void;
  actions?: SpaceSidePanelAction[];
  draggable?: boolean;
};

function matchesQuery(item: SpaceSidePanelItem, query: string) {
  const haystack = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
  return haystack.includes(query);
}

function getPreviewLabel(item: SpaceSidePanelItem) {
  return ((item.previewLabel ?? item.title.trim().slice(0, 1)) || "?").toUpperCase();
}

function PreviewBadge({
  item,
  className,
}: {
  item: SpaceSidePanelItem;
  className?: string;
}) {
  if (item.previewImageUrl) {
    return (
      <span
        className={cn(
          "relative overflow-hidden rounded-[20px] border border-white/10 bg-black/20 shadow-[var(--shadow-soft)]",
          className
        )}
      >
        <img
          alt={item.title}
          className="h-full w-full object-cover"
          draggable={false}
          src={item.previewImageUrl}
        />
        {item.kind === "group" ? (
          <span className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/35" />
        ) : null}
      </span>
    );
  }

  if (item.kind === "group") {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-[20px] bg-gradient-to-br text-white shadow-[var(--shadow-soft)]",
          item.accentClassName || "from-[var(--app-brand)] to-[var(--app-brand-strong)]",
          className
        )}
      >
        <FolderOpen className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel)] text-sm font-semibold text-[var(--app-brand)]",
        className
      )}
    >
      {getPreviewLabel(item)}
    </span>
  );
}

export function SpaceSidePanel({
  title,
  items,
  actions,
  onMoveItem,
}: {
  title: string;
  items: SpaceSidePanelItem[];
  actions?: ReactNode;
  onMoveItem?: (itemId: string, targetGroupId: string | null) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const draggedItemIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const groupIds = useMemo(
    () => items.filter((item) => item.kind === "group").map((item) => item.id),
    [items]
  );

  useEffect(() => {
    setExpandedGroupIds((current) => {
      const next = initializedRef.current ? new Set(current) : new Set<string>();
      let changed = !initializedRef.current;

      groupIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });

      Array.from(next).forEach((id) => {
        if (!groupIds.includes(id)) {
          next.delete(id);
          changed = true;
        }
      });

      initializedRef.current = true;
      return changed ? next : current;
    });
  }, [groupIds]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const itemsByParentId = useMemo(() => {
    const map = new Map<string | null, SpaceSidePanelItem[]>();

    items.forEach((item) => {
      const key = item.parentId ?? null;
      const bucket = map.get(key) ?? [];

      bucket.push(item);
      map.set(key, bucket);
    });

    return map;
  }, [items]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleIds = useMemo(() => {
    if (!normalizedQuery) {
      return null;
    }

    const ids = new Set<string>();

    const includeAncestors = (itemId: string) => {
      let current = itemsById.get(itemId) ?? null;

      while (current) {
        ids.add(current.id);
        current = current.parentId ? itemsById.get(current.parentId) ?? null : null;
      }
    };

    const includeDescendants = (itemId: string) => {
      (itemsByParentId.get(itemId) ?? []).forEach((child) => {
        if (ids.has(child.id)) {
          return;
        }

        ids.add(child.id);

        if (child.kind === "group") {
          includeDescendants(child.id);
        }
      });
    };

    items.forEach((item) => {
      if (!matchesQuery(item, normalizedQuery)) {
        return;
      }

      includeAncestors(item.id);

      if (item.kind === "group") {
        includeDescendants(item.id);
      }
    });

    return ids;
  }, [items, itemsById, itemsByParentId, normalizedQuery]);

  const rootItems = useMemo(
    () => (itemsByParentId.get(null) ?? []).filter((item) => !visibleIds || visibleIds.has(item.id)),
    [itemsByParentId, visibleIds]
  );

  function logDnd(event: string, payload: Record<string, unknown>) {
    debugSpaceEvent(`list-dnd:${event}`, {
      source: "space-side-panel",
      ...payload,
    });
  }

  function warnDnd(event: string, payload: Record<string, unknown>) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.warn(`[space:list-dnd:${event}]`, {
      source: "space-side-panel",
      ...payload,
    });
  }

  function errorDnd(event: string, payload: Record<string, unknown>) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.error(`[space:list-dnd:${event}]`, {
      source: "space-side-panel",
      ...payload,
    });
  }

  function isDescendantOf(itemId: string, ancestorId: string) {
    let current = itemsById.get(itemId) ?? null;

    while (current?.parentId) {
      if (current.parentId === ancestorId) {
        return true;
      }

      current = itemsById.get(current.parentId) ?? null;
    }

    return false;
  }

  function beginDrag(event: DragEvent<HTMLElement>, itemId: string) {
    const item = itemsById.get(itemId) ?? null;

    draggedItemIdRef.current = itemId;
    setDraggedItemId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.setData("application/x-space-item-id", itemId);
    logDnd("drag-start", {
      itemId,
      itemKind: item?.kind ?? null,
      parentId: item?.parentId ?? null,
      dataTransferTypes: Array.from(event.dataTransfer.types),
    });
  }

  function finishDrag() {
    const activeDraggedItemId = draggedItemIdRef.current || draggedItemId;

    if (activeDraggedItemId || dropTargetGroupId) {
      logDnd("drag-end", {
        itemId: activeDraggedItemId,
        dropTargetGroupId,
      });
    }

    draggedItemIdRef.current = null;
    setDraggedItemId(null);
    setDropTargetGroupId(null);
  }

  function getDraggedItemId(event?: DragEvent<HTMLElement>) {
    const fromTransfer =
      event?.dataTransfer.getData("application/x-space-item-id") ||
      event?.dataTransfer.getData("text/plain") ||
      null;

    return fromTransfer || draggedItemIdRef.current || draggedItemId;
  }

  function validateDropTarget(
    targetGroupId: string | null,
    event?: DragEvent<HTMLElement>
  ) {
    const activeDraggedItemId = getDraggedItemId(event);
    const activeDraggedItem = activeDraggedItemId
      ? itemsById.get(activeDraggedItemId) ?? null
      : null;

    if (!onMoveItem) {
      return {
        canAccept: false,
        reason: "missing-move-handler",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    if (!activeDraggedItemId) {
      return {
        canAccept: false,
        reason: "missing-dragged-item-id",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    if (!activeDraggedItem) {
      return {
        canAccept: false,
        reason: "dragged-item-not-found",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    if (targetGroupId && activeDraggedItemId === targetGroupId) {
      return {
        canAccept: false,
        reason: "same-item",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    if (
      targetGroupId &&
      activeDraggedItem.kind === "group" &&
      isDescendantOf(targetGroupId, activeDraggedItemId)
    ) {
      return {
        canAccept: false,
        reason: "target-is-descendant",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    if ((activeDraggedItem.parentId ?? null) === targetGroupId) {
      return {
        canAccept: false,
        reason: "already-in-target",
        activeDraggedItemId,
        activeDraggedItem,
      };
    }

    return {
      canAccept: true,
      reason: "accepted",
      activeDraggedItemId,
      activeDraggedItem,
    };
  }

  async function commitMove(itemId: string, targetGroupId: string | null, origin: string) {
    const item = itemsById.get(itemId) ?? null;

    logDnd("move-commit", {
      origin,
      itemId,
      itemKind: item?.kind ?? null,
      fromParentId: item?.parentId ?? null,
      targetGroupId,
    });

    try {
      await Promise.resolve(onMoveItem?.(itemId, targetGroupId));
      logDnd("move-success", {
        origin,
        itemId,
        targetGroupId,
      });
    } catch (error) {
      errorDnd("move-failed", {
        origin,
        itemId,
        targetGroupId,
        error,
      });
    } finally {
      finishDrag();
    }
  }

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function handleOpen() {
    clearCloseTimer();
    setOpen(true);
  }

  function handleClose() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 140);
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  }

  function handleRowKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    onActivate: () => void
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onActivate();
  }

  function getItemLabel(entry: SpaceSidePanelItem) {
    const trimmedTitle = entry.title.trim();

    if (trimmedTitle) {
      return trimmedTitle;
    }

    return entry.kind === "group" ? t("untitledGroup") : entry.id;
  }

  function getGroupPathLabel(groupId: string) {
    const labels: string[] = [];
    const visited = new Set<string>();
    let current = itemsById.get(groupId) ?? null;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      labels.unshift(getItemLabel(current));
      current = current.parentId ? itemsById.get(current.parentId) ?? null : null;
    }

    return labels.join(" / ");
  }

  function buildMoveMenuAction(item: SpaceSidePanelItem): SpaceSidePanelAction | null {
    if (!onMoveItem || item.draggable !== true) {
      return null;
    }

    const currentParentId = item.parentId ?? null;
    const currentParent = currentParentId ? itemsById.get(currentParentId) ?? null : null;
    const moveUpTargetId = currentParent?.parentId ?? null;
    const candidateGroups = items.filter((entry) => {
      if (entry.kind !== "group") {
        return false;
      }

      if (entry.id === item.id || entry.id === currentParentId || entry.id === moveUpTargetId) {
        return false;
      }

      if (item.kind === "group" && isDescendantOf(entry.id, item.id)) {
        return false;
      }

      return true;
    });
    const children: SpaceSidePanelAction[] = [];

    if (currentParentId) {
      children.push({
        id: `move-up-${item.id}`,
        icon: <CornerUpLeft className="h-4 w-4" />,
        label: t("moveUpOneLevel"),
        onClick: () => {
          void commitMove(item.id, moveUpTargetId, "menu-move-up");
        },
      });
    }

    if (currentParentId && moveUpTargetId !== null) {
      children.push({
        id: `move-root-${item.id}`,
        icon: <FolderOpen className="h-4 w-4" />,
        label: t("moveToRoot"),
        onClick: () => {
          void commitMove(item.id, null, "menu-move-root");
        },
      });
    }

    candidateGroups.forEach((group) => {
      children.push({
        id: `move-${item.id}-to-${group.id}`,
        icon: <FolderOpen className="h-4 w-4" />,
        label: getGroupPathLabel(group.id),
        onClick: () => {
          void commitMove(item.id, group.id, "menu-move-group");
        },
      });
    });

    if (!children.length) {
      return null;
    }

    return {
      id: `move-${item.id}`,
      icon: <FolderInput className="h-4 w-4" />,
      label: t("moveTo"),
      children,
    };
  }

  function resolveMenuActions(item: SpaceSidePanelItem) {
    const baseActions = item.actions ? [...item.actions] : [];
    const moveAction = buildMoveMenuAction(item);

    if (!moveAction) {
      return baseActions;
    }

    const firstDangerIndex = baseActions.findIndex((action) => action.tone === "danger");

    if (firstDangerIndex === -1) {
      return [...baseActions, moveAction];
    }

    return [
      ...baseActions.slice(0, firstDangerIndex),
      moveAction,
      ...baseActions.slice(firstDangerIndex),
    ];
  }

  function renderActionContent(action: SpaceSidePanelAction) {
    return (
      <>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {action.icon ?? null}
        </span>
        <span className="truncate">{action.label}</span>
      </>
    );
  }

  function renderMenuAction(action: SpaceSidePanelAction): ReactNode {
    if (action.children?.length) {
      return (
        <DropdownMenuSub key={action.id}>
          <DropdownMenuSubTrigger className="gap-2">
            {renderActionContent(action)}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {action.children.map((child) => renderMenuAction(child))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }

    return (
      <DropdownMenuItem
        className={cn(action.tone === "danger" ? "text-rose-500 focus:text-rose-500" : "")}
        disabled={action.disabled}
        key={action.id}
        onClick={() => action.onClick?.()}
      >
        {renderActionContent(action)}
      </DropdownMenuItem>
    );
  }

  function renderActionMenu(actions: SpaceSidePanelAction[]) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="rounded-full"
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action) => renderMenuAction(action))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function renderItems(parentId: string | null, depth: number): ReactNode {
    const children = (itemsByParentId.get(parentId) ?? []).filter(
      (item) => !visibleIds || visibleIds.has(item.id)
    );

    return children.map((item) => {
      const nestedChildren = (itemsByParentId.get(item.id) ?? []).filter(
        (child) => !visibleIds || visibleIds.has(child.id)
      );
      const isExpanded = normalizedQuery ? true : expandedGroupIds.has(item.id);
      const paddingLeft = 12 + depth * 16;
      const draggable = !!onMoveItem && item.draggable === true;
      const menuActions = resolveMenuActions(item);

      if (item.kind === "group") {
        return (
          <div className="space-y-2" key={item.id}>
            <div
              onDragOver={(event) => {
                const validation = validateDropTarget(item.id, event);

                if (!validation.canAccept) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                setDropTargetGroupId((current) => {
                  if (current !== item.id) {
                    logDnd("drop-target-group", {
                      itemId: validation.activeDraggedItemId,
                      itemKind: validation.activeDraggedItem?.kind ?? null,
                      targetGroupId: item.id,
                    });
                  }

                  return item.id;
                });
              }}
              onDrop={(event) => {
                const validation = validateDropTarget(item.id, event);

                if (!validation.canAccept || !validation.activeDraggedItemId) {
                  warnDnd("drop-rejected", {
                    reason: validation.reason,
                    targetGroupId: item.id,
                    itemId: validation.activeDraggedItemId,
                  });
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                void commitMove(validation.activeDraggedItemId, item.id, "group-drop");
              }}
              style={{ marginLeft: paddingLeft }}
            >
              <div
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <div
                  className={cn(
                    "group/item flex items-center gap-3 rounded-[24px] border bg-[var(--app-panel)]/95 px-3 py-3 shadow-[var(--shadow-soft)] transition",
                    dropTargetGroupId === item.id
                      ? "border-[var(--app-brand)] ring-2 ring-[var(--app-brand-soft)]"
                      : "border-[var(--app-border)] hover:border-[var(--app-brand-soft)] hover:bg-[var(--card-hover)]"
                  )}
                  draggable={draggable}
                  onDragEnd={draggable ? finishDrag : undefined}
                  onDragStart={
                    draggable
                      ? (event) => {
                          beginDrag(event, item.id);
                        }
                      : undefined
                  }
                  onPointerDown={
                    draggable
                      ? () => {
                          logDnd("pointer-down", {
                            itemId: item.id,
                            itemKind: item.kind,
                            parentId: item.parentId ?? null,
                          });
                        }
                      : undefined
                  }
                  title={item.title}
                >
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => toggleGroup(item.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, () => toggleGroup(item.id))}
                    role="button"
                    tabIndex={0}
                  >
                    <PreviewBadge className="h-12 w-12 shrink-0" item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--app-text)]">
                        {item.title}
                      </span>
                      {item.subtitle ? (
                        <span className="mt-1 block truncate text-xs text-[var(--app-muted)]">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-[var(--app-muted)] transition",
                        isExpanded ? "rotate-90" : ""
                      )}
                    />
                  </div>
                  {menuActions.length ? (
                    <div className="shrink-0 opacity-100 md:opacity-0 md:transition md:group-hover/item:opacity-100">
                      {renderActionMenu(menuActions)}
                    </div>
                  ) : null}
                </div>
              </div>
              {isExpanded && nestedChildren.length ? (
                <div className="space-y-2">{renderItems(item.id, depth + 1)}</div>
              ) : null}
            </div>
          </div>
        );
      }

      return (
        <div
          className="group/item flex items-center gap-3 rounded-[22px] border border-transparent bg-transparent px-3 py-2 transition hover:border-[var(--app-border)] hover:bg-[var(--app-panel-soft)]/75"
          draggable={draggable}
          key={item.id}
          onDragEnd={draggable ? finishDrag : undefined}
          onDragStart={(event) => {
            if (!draggable) {
              event.preventDefault();
              return;
            }

            beginDrag(event, item.id);
          }}
          onPointerDown={
            draggable
              ? () => {
                  logDnd("pointer-down", {
                    itemId: item.id,
                    itemKind: item.kind,
                    parentId: item.parentId ?? null,
                  });
                }
              : undefined
          }
          style={{ marginLeft: paddingLeft }}
        >
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
            onClick={() => item.onClick?.()}
            onKeyDown={(event) => handleRowKeyDown(event, () => item.onClick?.())}
            role="button"
            tabIndex={0}
          >
            <PreviewBadge className="h-11 w-11 shrink-0" item={item} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--app-text)]">
                {item.title}
              </span>
              {item.subtitle ? (
                <span className="mt-1 block truncate text-xs text-[var(--app-muted)]">
                  {item.subtitle}
                </span>
              ) : null}
            </span>
          </div>
          {menuActions.length ? (
            <div className="shrink-0 opacity-100 md:opacity-0 md:transition md:group-hover/item:opacity-100">
              {renderActionMenu(menuActions)}
            </div>
          ) : null}
        </div>
      );
    });
  }

  const rootDropVisible = !!onMoveItem && !!draggedItemId;

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-stretch pl-2"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <div
        className={cn(
          "pointer-events-auto relative flex h-full max-w-[calc(100vw-0.75rem)] items-center transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-[calc(100%-1rem)]"
        )}
      >
        <div className="my-4 flex h-[calc(100%-2rem)] w-[min(400px,calc(100vw-2.75rem))] flex-col overflow-hidden rounded-[32px] border border-[var(--app-border)] bg-[var(--app-sidebar)]/94 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          <div className="border-b border-[var(--app-border)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="sr-only">{title}</span>
              {actions ? <div className="flex min-w-0 flex-wrap gap-2">{actions}</div> : <div />}
              <Button
                aria-label={open ? t("spaceListHide") : t("spaceListShow")}
                className="shrink-0 rounded-full"
                onClick={() => {
                  clearCloseTimer();
                  setOpen((current) => !current);
                }}
                size="icon"
                variant="ghost"
              >
                {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
            </div>

            <SearchField
              className="mt-4"
              onChange={setQuery}
              placeholder={t("spaceListSearchPlaceholder")}
              value={query}
            />
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 py-3"
            onDragOver={(event) => {
              const validation = validateDropTarget(null, event);

              if (!validation.canAccept) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetGroupId((current) => {
                if (current !== null) {
                  logDnd("drop-target-root", {
                    itemId: validation.activeDraggedItemId,
                    itemKind: validation.activeDraggedItem?.kind ?? null,
                  });
                }

                return null;
              });
            }}
            onDrop={(event) => {
              const validation = validateDropTarget(null, event);

              if (!validation.canAccept || !validation.activeDraggedItemId) {
                warnDnd("drop-rejected", {
                  reason: validation.reason,
                  targetGroupId: null,
                  itemId: validation.activeDraggedItemId,
                });
                return;
              }

              if (event.target !== event.currentTarget) {
                return;
              }

              event.preventDefault();
              void commitMove(validation.activeDraggedItemId, null, "root-drop");
            }}
          >
            {rootDropVisible ? (
              <div
                className={cn(
                  "mb-3 rounded-[22px] border border-dashed px-4 py-3 text-sm transition",
                  dropTargetGroupId
                    ? "border-[var(--app-border)] bg-transparent text-[var(--app-muted)]"
                    : "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--app-brand)]"
                )}
                onDragOver={(event) => {
                  const validation = validateDropTarget(null, event);

                  if (!validation.canAccept) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTargetGroupId(null);
                }}
                onDrop={(event) => {
                  const validation = validateDropTarget(null, event);

                  if (!validation.canAccept || !validation.activeDraggedItemId) {
                    warnDnd("drop-rejected", {
                      reason: validation.reason,
                      targetGroupId: null,
                      itemId: validation.activeDraggedItemId,
                    });
                    return;
                  }

                  event.preventDefault();
                  void commitMove(validation.activeDraggedItemId, null, "root-card-drop");
                }}
              >
                <p className="font-medium">{t("moveToRoot")}</p>
                <p className="mt-1 text-xs opacity-80">{t("moveToRootHint")}</p>
              </div>
            ) : null}

            {rootItems.length ? (
              <div className="space-y-2 pb-2">{renderItems(null, 0)}</div>
            ) : (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-5 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-brand)]">
                  <Search className="h-4 w-4" />
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--app-text)]">
                  {t("spaceListEmptyTitle")}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                  {t("spaceListEmptyDescription")}
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          aria-label={open ? t("spaceListHide") : t("spaceListShow")}
          className="mb-auto mt-24 flex h-14 w-5 shrink-0 items-center justify-center rounded-r-2xl border border-l-0 border-[var(--app-border)] bg-[var(--app-sidebar)]/92 text-[var(--app-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition hover:text-[var(--app-text)]"
          onClick={() => {
            clearCloseTimer();
            setOpen((current) => !current);
          }}
          type="button"
        >
          <PanelLeftOpen className={cn("h-4 w-4 transition", open ? "rotate-180" : "")} />
        </button>
      </div>
    </div>
  );
}
