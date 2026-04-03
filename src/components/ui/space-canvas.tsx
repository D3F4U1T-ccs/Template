import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useAppData } from "@/hooks/use-app-data";
import { cn } from "@/shared/lib/utils";
import type { SpacePlacement, SpaceViewport } from "@/types/models";
import { debugSpaceEvent } from "@/utils/space-debug";
import { clampZoom } from "@/utils/space";

export interface SpaceCanvasNode<T> {
  id: string;
  placement: SpacePlacement;
  data: T;
  resizable?: boolean;
  minSize?: {
    width: number;
    height: number;
  };
  zIndex?: number;
}

type SpaceCanvasProps<T> = {
  nodes: Array<SpaceCanvasNode<T>>;
  viewport: SpaceViewport;
  onViewportChange: (viewport: SpaceViewport) => void;
  onPlacementCommit: (id: string, placement: SpacePlacement) => void;
  onNodeClick?: (node: SpaceCanvasNode<T>) => void;
  getLinkedNodeIds?: (node: SpaceCanvasNode<T>) => string[];
  renderNode: (
    node: SpaceCanvasNode<T>,
    options: { isDragging: boolean; isLinkedDragging: boolean }
  ) => React.ReactNode;
  className?: string;
  canvasClassName?: string;
  emptyState?: React.ReactNode;
  size?: {
    width: number;
    height: number;
  };
};

type DragState = {
  id: string;
  startClientX: number;
  startClientY: number;
  origin: SpacePlacement;
  moved: boolean;
  linkedOrigins: Array<{
    id: string;
    placement: SpacePlacement;
  }>;
};

type PanState = {
  startClientX: number;
  startClientY: number;
  origin: SpaceViewport;
};

type ResizeDirection =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

type ResizeState = {
  id: string;
  startClientX: number;
  startClientY: number;
  origin: SpacePlacement;
  direction: ResizeDirection;
  minWidth: number;
  minHeight: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return !!target.closest(
    "button, a, input, textarea, select, [data-space-no-drag='true'], [data-space-resize='true']"
  );
}

function getResizedPlacement(
  origin: SpacePlacement,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number
) {
  let nextX = origin.x;
  let nextY = origin.y;
  let nextWidth = origin.width;
  let nextHeight = origin.height;

  if (direction.includes("e")) {
    nextWidth = Math.max(minWidth, origin.width + dx);
  }

  if (direction.includes("s")) {
    nextHeight = Math.max(minHeight, origin.height + dy);
  }

  if (direction.includes("w")) {
    const maxLeftShift = origin.width - minWidth;
    const shift = Math.min(dx, maxLeftShift);
    nextX = origin.x + shift;
    nextWidth = origin.width - shift;
  }

  if (direction.includes("n")) {
    const maxTopShift = origin.height - minHeight;
    const shift = Math.min(dy, maxTopShift);
    nextY = origin.y + shift;
    nextHeight = origin.height - shift;
  }

  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight,
  };
}

export function SpaceCanvas<T>({
  nodes,
  viewport,
  onViewportChange,
  onPlacementCommit,
  onNodeClick,
  getLinkedNodeIds,
  renderNode,
  className,
  canvasClassName,
  emptyState,
  size = {
    width: 2400,
    height: 1600,
  },
}: SpaceCanvasProps<T>) {
  const { settings } = useAppData();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftPlacements, setDraftPlacements] = useState<Record<string, SpacePlacement>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [linkedDraggingIds, setLinkedDraggingIds] = useState<string[]>([]);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const suppressClickUntilRef = useRef(0);

  useEffect(() => {
    if (dragRef.current || resizeRef.current) {
      return;
    }

    const nextPlacements = Object.fromEntries(
      nodes.map((node) => [node.id, node.placement])
    ) as Record<string, SpacePlacement>;

    setDraftPlacements(nextPlacements);
  }, [nodes]);

  const resolvedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        placement: draftPlacements[node.id] ?? node.placement,
      })),
    [draftPlacements, nodes]
  );

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const currentDrag = dragRef.current;

      if (currentDrag) {
        const dx = (event.clientX - currentDrag.startClientX) / viewport.zoom;
        const dy = (event.clientY - currentDrag.startClientY) / viewport.zoom;
        const moved = Math.abs(dx) > 6 || Math.abs(dy) > 6;
        const nextPlacement: SpacePlacement = {
          ...currentDrag.origin,
          x: currentDrag.origin.x + dx,
          y: currentDrag.origin.y + dy,
        };

        dragRef.current = {
          ...currentDrag,
          moved,
        };

        setDraftPlacements((current) => ({
          ...current,
          [currentDrag.id]: nextPlacement,
          ...Object.fromEntries(
            currentDrag.linkedOrigins.map((linked) => [
              linked.id,
              {
                ...linked.placement,
                x: linked.placement.x + dx,
                y: linked.placement.y + dy,
              },
            ])
          ),
        }));
        return;
      }

      const currentResize = resizeRef.current;

      if (currentResize) {
        const dx = (event.clientX - currentResize.startClientX) / viewport.zoom;
        const dy = (event.clientY - currentResize.startClientY) / viewport.zoom;
        const nextPlacement = getResizedPlacement(
          currentResize.origin,
          currentResize.direction,
          dx,
          dy,
          currentResize.minWidth,
          currentResize.minHeight
        );

        setDraftPlacements((current) => ({
          ...current,
          [currentResize.id]: nextPlacement,
        }));
        return;
      }

      if (panRef.current) {
        onViewportChange({
          ...panRef.current.origin,
          x: panRef.current.origin.x + (event.clientX - panRef.current.startClientX),
          y: panRef.current.origin.y + (event.clientY - panRef.current.startClientY),
        });
      }
    }

    function finishPointer() {
      if (dragRef.current) {
        const currentDrag = dragRef.current;
        const placement = draftPlacements[currentDrag.id] ?? currentDrag.origin;
        const changed =
          placement.x !== currentDrag.origin.x ||
          placement.y !== currentDrag.origin.y ||
          placement.width !== currentDrag.origin.width ||
          placement.height !== currentDrag.origin.height;

        if (currentDrag.moved || changed) {
          onPlacementCommit(currentDrag.id, placement);
          suppressClickUntilRef.current = performance.now() + 180;
        } else if (onNodeClick) {
          const node = resolvedNodes.find((entry) => entry.id === currentDrag.id);

          if (node) {
            onNodeClick(node);
          }
        }
      }

      if (resizeRef.current) {
        const currentResize = resizeRef.current;
        const placement = draftPlacements[currentResize.id] ?? currentResize.origin;
        const changed =
          placement.x !== currentResize.origin.x ||
          placement.y !== currentResize.origin.y ||
          placement.width !== currentResize.origin.width ||
          placement.height !== currentResize.origin.height;

        if (changed) {
          onPlacementCommit(currentResize.id, placement);
          suppressClickUntilRef.current = performance.now() + 180;
        }
      }

      dragRef.current = null;
      panRef.current = null;
      resizeRef.current = null;
      setDraggingId(null);
      setLinkedDraggingIds([]);
      setResizingId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
    };
  }, [
    draftPlacements,
    onNodeClick,
    onPlacementCommit,
    onViewportChange,
    resolvedNodes,
    viewport.zoom,
  ]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const rect = containerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const boardX = (pointerX - viewport.x) / viewport.zoom;
        const boardY = (pointerY - viewport.y) / viewport.zoom;
        const wheelDelta =
          event.deltaMode === 1 ? event.deltaY * 18 : event.deltaMode === 2 ? event.deltaY * 72 : event.deltaY;
        const normalizedDelta = clamp(wheelDelta, -180, 180);
        const zoomFactor = Math.exp(-normalizedDelta * 0.0018);
        const nextZoom = clampZoom(viewport.zoom * zoomFactor);

        if (nextZoom === viewport.zoom) {
          debugSpaceEvent("zoom-clamped", {
            currentZoom: viewport.zoom,
            deltaY: event.deltaY,
          });
          return;
        }

        debugSpaceEvent("zoom-wheel", {
          currentZoom: viewport.zoom,
          nextZoom,
          deltaY: event.deltaY,
        });

        onViewportChange({
          x: pointerX - boardX * nextZoom,
          y: pointerY - boardY * nextZoom,
          zoom: nextZoom,
        });
        return;
      }

      if (event.shiftKey) {
        onViewportChange({
          ...viewport,
          x: viewport.x - event.deltaY * 0.8 - event.deltaX * 0.4,
        });
        return;
      }

      onViewportChange({
        ...viewport,
        x: viewport.x - event.deltaX * 0.7,
        y: viewport.y - event.deltaY * 0.8,
      });
    },
    [onViewportChange, viewport]
  );

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  function startNodeDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    node: SpaceCanvasNode<T>
  ) {
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();

      panRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        origin: viewport,
      };
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragRef.current = {
      id: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: draftPlacements[node.id] ?? node.placement,
      moved: false,
      linkedOrigins: (getLinkedNodeIds?.(node) ?? [])
        .map((linkedId) => {
          const linkedNode = resolvedNodes.find((entry) => entry.id === linkedId);

          if (!linkedNode) {
            return null;
          }

          return {
            id: linkedId,
            placement: draftPlacements[linkedId] ?? linkedNode.placement,
          };
        })
        .filter(
          (
            entry
          ): entry is {
            id: string;
            placement: SpacePlacement;
          } => !!entry
        ),
    };
    setDraggingId(node.id);
    setLinkedDraggingIds(dragRef.current.linkedOrigins.map((entry) => entry.id));
  }

  function startResize(
    event: ReactPointerEvent<HTMLDivElement>,
    node: SpaceCanvasNode<T>,
    direction: ResizeDirection
  ) {
    event.preventDefault();
    event.stopPropagation();

    const placement = draftPlacements[node.id] ?? node.placement;

    resizeRef.current = {
      id: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: placement,
      direction,
      minWidth: node.minSize?.width ?? 220,
      minHeight: node.minSize?.height ?? 180,
    };
    setResizingId(node.id);
  }

  function startCanvasPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button === 2) {
      event.preventDefault();

      panRef.current = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        origin: viewport,
      };
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();

    panRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: viewport,
    };
  }

  const resizeHandles: Array<{
    direction: ResizeDirection;
    className: string;
  }> = [
    { direction: "n", className: "left-3 right-3 top-0 h-3 -translate-y-1/2 cursor-ns-resize" },
    { direction: "s", className: "bottom-0 left-3 right-3 h-3 translate-y-1/2 cursor-ns-resize" },
    { direction: "e", className: "bottom-3 right-0 top-3 w-3 translate-x-1/2 cursor-ew-resize" },
    { direction: "w", className: "bottom-3 left-0 top-3 w-3 -translate-x-1/2 cursor-ew-resize" },
    { direction: "ne", className: "right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
    { direction: "nw", className: "left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
    { direction: "se", className: "bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
    { direction: "sw", className: "bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
  ];

  return (
    <div
      className={cn(
        "relative min-h-[640px] overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[var(--canvas-shell)] shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          settings.canvasPattern === "grid"
            ? "bg-[linear-gradient(to_right,var(--canvas-dot)_1px,transparent_1px),linear-gradient(to_bottom,var(--canvas-dot)_1px,transparent_1px)] [background-size:28px_28px]"
            : "bg-[radial-gradient(circle_at_1px_1px,var(--canvas-dot)_1px,transparent_0)] [background-size:22px_22px]"
        )}
        aria-hidden
        style={{ opacity: settings.canvasOpacity }}
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02))]"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-10 touch-none"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={startCanvasPan}
        ref={containerRef}
      >
        <div
          className={cn("relative origin-top-left", canvasClassName)}
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            willChange: "transform",
          }}
        >
          {resolvedNodes.map((node) => (
            <div
              className="absolute"
              onContextMenu={(event) => event.preventDefault()}
              onDragStart={(event) => event.preventDefault()}
              key={node.id}
              onPointerDown={(event) => startNodeDrag(event, node)}
              style={{
                left: node.placement.x,
                top: node.placement.y,
                width: node.placement.width,
                height: node.placement.height,
                zIndex:
                  resizingId === node.id
                    ? 40
                    : linkedDraggingIds.includes(node.id)
                      ? 35
                    : draggingId === node.id
                      ? 30
                      : node.zIndex ?? 10,
              }}
            >
              {renderNode(node, {
                isDragging: draggingId === node.id,
                isLinkedDragging: linkedDraggingIds.includes(node.id),
              })}
              {node.resizable
                ? resizeHandles.map((handle) => (
                    <div
                      className={cn("absolute z-20 rounded-full", handle.className)}
                      data-space-no-drag="true"
                      data-space-resize="true"
                      key={`${node.id}-${handle.direction}`}
                      onPointerDown={(event) => startResize(event, node, handle.direction)}
                    />
                  ))
                : null}
            </div>
          ))}
        </div>
      </div>

      {resolvedNodes.length === 0 && emptyState ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          {emptyState}
        </div>
      ) : null}
    </div>
  );
}
