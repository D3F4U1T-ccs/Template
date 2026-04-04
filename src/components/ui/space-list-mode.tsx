import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { CornerUpLeft, FolderInput, FolderOpen, MoreHorizontal, Search } from "lucide-react";

import { CardSurface } from "@/components/ui/primitives";
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
import type { SpaceSidePanelAction, SpaceSidePanelItem } from "@/components/ui/space-side-panel";

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
          "relative overflow-hidden rounded-[24px] border border-white/10 bg-black/20 shadow-[var(--shadow-soft)]",
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
          "flex items-center justify-center rounded-[24px] bg-gradient-to-br text-white shadow-[var(--shadow-soft)]",
          item.accentClassName || "from-[var(--app-brand)] to-[var(--app-brand-strong)]",
          className
        )}
      >
        <FolderOpen className="h-5 w-5" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel)] text-base font-semibold text-[var(--app-brand)]",
        className
      )}
    >
      {getPreviewLabel(item)}
    </span>
  );
}

export function SpaceListMode({
  title,
  items,
  actions,
  onExit,
  onMoveItem,
}: {
  title: string;
  items: SpaceSidePanelItem[];
  actions?: ReactNode;
  onExit: () => void;
  onMoveItem?: (itemId: string, targetGroupId: string | null) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const draggedItemIdRef = useRef<string | null>(null);

  const groupIds = useMemo(
    () => items.filter((item) => item.kind === "group").map((item) => item.id),
    [items]
  );

  useEffect(() => {
    setExpandedGroupIds(new Set(groupIds));
  }, [groupIds]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onExit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onExit]);

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

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const rootItems = useMemo(() => itemsByParentId.get(null) ?? [], [itemsByParentId]);

  function logDnd(event: string, payload: Record<string, unknown>) {
    debugSpaceEvent(`list-dnd:${event}`, {
      source: "space-list-mode",
      ...payload,
    });
  }

  function warnDnd(event: string, payload: Record<string, unknown>) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.warn(`[space:list-dnd:${event}]`, {
      source: "space-list-mode",
      ...payload,
    });
  }

  function errorDnd(event: string, payload: Record<string, unknown>) {
    if (!import.meta.env.DEV) {
      return;
    }

    console.error(`[space:list-dnd:${event}]`, {
      source: "space-list-mode",
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
        className={action.tone === "danger" ? "text-rose-500 focus:text-rose-500" : ""}
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
    const children = itemsByParentId.get(parentId) ?? [];

    if (!children.length) {
      return null;
    }

    return children.map((item) => {
      const nestedChildren = itemsByParentId.get(item.id) ?? [];
      const isExpanded = expandedGroupIds.has(item.id);
      const draggable = !!onMoveItem && item.draggable === true;
      const menuActions = resolveMenuActions(item);

      if (item.kind === "group") {
        return (
          <div
            key={item.id}
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
            style={{ marginLeft: depth * 18 }}
          >
            <CardSurface
              className={cn(
                "overflow-hidden border bg-[var(--app-panel)]/96 shadow-[var(--shadow-soft)] transition",
                dropTargetGroupId === item.id
                  ? "border-[var(--app-brand)] ring-2 ring-[var(--app-brand-soft)]"
                  : "border-[var(--app-border)]"
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
            >
              <div className="flex items-center justify-between gap-4 px-5 py-5">
                <div
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                  onClick={() => toggleGroup(item.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, () => toggleGroup(item.id))}
                  role="button"
                  tabIndex={0}
                >
                  <PreviewBadge className="h-16 w-16 shrink-0" item={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-[var(--app-text)]">
                      {item.title}
                    </span>
                    {item.subtitle ? (
                      <span className="mt-1 block truncate text-sm text-[var(--app-muted)]">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {menuActions.length ? renderActionMenu(menuActions) : null}
                </div>
              </div>
              {isExpanded ? (
                <div
                  className="space-y-3 border-t border-[var(--app-border)] bg-[var(--app-panel-soft)]/28 px-4 py-4"
                  style={{ paddingLeft: 16 + depth * 14 }}
                >
                  {nestedChildren.length ? (
                    renderItems(item.id, depth + 1)
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-[var(--app-border)] px-4 py-8 text-sm text-[var(--app-muted)]">
                      {t("noGroup")}
                    </div>
                  )}
                </div>
              ) : null}
            </CardSurface>
          </div>
        );
      }

      return (
        <div
          className="group/item flex items-center gap-4 rounded-[26px] border border-[var(--app-border)] bg-[var(--app-panel)]/88 px-4 py-4 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[var(--card-hover)]"
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
          style={{ marginLeft: depth * 18 }}
        >
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
            onClick={() => item.onClick?.()}
            onKeyDown={(event) => handleRowKeyDown(event, () => item.onClick?.())}
            role="button"
            tabIndex={0}
          >
            <PreviewBadge className="h-14 w-14 shrink-0" item={item} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--app-text)]">
                {item.title}
              </span>
              {item.subtitle ? (
                <span className="mt-1 block line-clamp-2 text-sm leading-6 text-[var(--app-muted)]">
                  {item.subtitle}
                </span>
              ) : null}
            </span>
          </div>
          {menuActions.length ? renderActionMenu(menuActions) : null}
        </div>
      );
    });
  }

  const rootDropVisible = !!onMoveItem && !!draggedItemId;

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-[var(--app-bg)]">
      <span className="sr-only">{title}</span>

      {actions ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-2">{actions}</div>
        </div>
      ) : null}

      <div className="h-full overflow-y-auto px-4 pb-8 pt-24 md:px-6">
        <div
          className={cn(
            "mx-auto w-full max-w-6xl space-y-4 rounded-[36px] border border-transparent p-1 transition",
            rootDropVisible && !dropTargetGroupId
              ? "border-[var(--app-brand-soft)] bg-[var(--app-brand-soft)]/10"
              : ""
          )}
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
            <CardSurface
              className={cn(
                "border border-dashed px-5 py-4",
                dropTargetGroupId
                  ? "border-[var(--app-border)] bg-[var(--app-panel)]/88"
                  : "border-[var(--app-brand)] bg-[var(--app-brand-soft)]/70"
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
              <p className="text-sm font-semibold text-[var(--app-text)]">{t("moveToRoot")}</p>
              <p className="mt-1 text-sm text-[var(--app-muted)]">{t("moveToRootHint")}</p>
            </CardSurface>
          ) : null}

          {rootItems.length ? (
            <div className="space-y-4 pb-4">{renderItems(null, 0)}</div>
          ) : (
            <CardSurface className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-brand)]">
                <Search className="h-5 w-5" />
              </div>
              <p className="mt-5 text-lg font-semibold text-[var(--app-text)]">
                {t("spaceListEmptyTitle")}
              </p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--app-muted)]">
                {t("spaceListEmptyDescription")}
              </p>
            </CardSurface>
          )}
        </div>
      </div>
    </div>
  );
}
