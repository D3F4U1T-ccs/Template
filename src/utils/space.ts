import type { SpacePlacement, SpaceViewport } from "@/types/models";

export const SPACE_ZOOM_MIN = 0.18;
export const SPACE_ZOOM_MAX = 3.2;

export function clampZoom(value: number) {
  return Math.min(Math.max(value, SPACE_ZOOM_MIN), SPACE_ZOOM_MAX);
}

export function createGridPlacement(
  index: number,
  options?: Partial<{
    startX: number;
    startY: number;
    width: number;
    height: number;
    gapX: number;
    gapY: number;
    columns: number;
  }>
): SpacePlacement {
  const startX = options?.startX ?? 64;
  const startY = options?.startY ?? 64;
  const width = options?.width ?? 220;
  const height = options?.height ?? 220;
  const gapX = options?.gapX ?? 28;
  const gapY = options?.gapY ?? 28;
  const columns = options?.columns ?? 4;
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    x: startX + column * (width + gapX),
    y: startY + row * (height + gapY),
    width,
    height,
  };
}

export function createColumnPlacement(
  index: number,
  options?: Partial<{
    startX: number;
    startY: number;
    width: number;
    height: number;
    gapY: number;
  }>
): SpacePlacement {
  const startX = options?.startX ?? 64;
  const startY = options?.startY ?? 64;
  const width = options?.width ?? 320;
  const height = options?.height ?? 300;
  const gapY = options?.gapY ?? 28;

  return {
    x: startX,
    y: startY + index * (height + gapY),
    width,
    height,
  };
}

export function isPointInsidePlacement(
  placement: SpacePlacement,
  point: { x: number; y: number },
  padding = 0
) {
  return (
    point.x >= placement.x + padding &&
    point.x <= placement.x + placement.width - padding &&
    point.y >= placement.y + padding &&
    point.y <= placement.y + placement.height - padding
  );
}

export function getPlacementCenter(placement: SpacePlacement) {
  return {
    x: placement.x + placement.width / 2,
    y: placement.y + placement.height / 2,
  };
}

export function isPlacementCenterInsidePlacement(
  target: SpacePlacement,
  container: SpacePlacement,
  padding = 0
) {
  return isPointInsidePlacement(container, getPlacementCenter(target), padding);
}

export function getPlacementArea(placement: SpacePlacement) {
  return Math.max(0, placement.width) * Math.max(0, placement.height);
}

export function getPlacementIntersectionArea(
  left: SpacePlacement,
  right: SpacePlacement
) {
  const xOverlap = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  );

  return xOverlap * yOverlap;
}

export function getPlacementOverlapRatio(
  target: SpacePlacement,
  container: SpacePlacement
) {
  const targetArea = getPlacementArea(target);

  if (!targetArea) {
    return 0;
  }

  return getPlacementIntersectionArea(target, container) / targetArea;
}

export function getViewportWorldPoint(
  viewport: SpaceViewport,
  point: { x: number; y: number }
) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

export function getDefaultSurfaceSize() {
  return {
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  };
}

export function createPlacementAtViewportCenter(
  viewport: SpaceViewport,
  size: { width: number; height: number },
  surface = getDefaultSurfaceSize()
): SpacePlacement {
  const center = getViewportWorldPoint(viewport, {
    x: surface.width / 2,
    y: surface.height / 2,
  });

  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

export function createViewportCenteredOnPlacement(
  placement: SpacePlacement,
  viewport: SpaceViewport,
  surface = getDefaultSurfaceSize()
): SpaceViewport {
  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;

  return {
    x: surface.width / 2 - centerX * viewport.zoom,
    y: surface.height / 2 - centerY * viewport.zoom,
    zoom: viewport.zoom,
  };
}

export function getInnermostContainingEntry<T>(
  target: SpacePlacement,
  entries: T[],
  getPlacement: (entry: T) => SpacePlacement,
  padding = 0
) {
  return (
    entries
      .map((entry) => ({
        entry,
        placement: getPlacement(entry),
      }))
      .filter(({ placement }) =>
        isPlacementCenterInsidePlacement(target, placement, padding)
      )
      .sort(
        (left, right) =>
          getPlacementArea(left.placement) - getPlacementArea(right.placement)
      )[0]?.entry ?? null
  );
}

type ContainerLayoutOptions = Partial<{
  columns: number;
  gapX: number;
  gapY: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}>;

function resolveContainerLayout(options?: ContainerLayoutOptions) {
  return {
    columns: Math.max(1, options?.columns ?? 3),
    gapX: options?.gapX ?? 28,
    gapY: options?.gapY ?? 28,
    paddingLeft: options?.paddingLeft ?? 28,
    paddingRight: options?.paddingRight ?? options?.paddingLeft ?? 28,
    paddingTop: options?.paddingTop ?? 84,
    paddingBottom: options?.paddingBottom ?? 28,
  };
}

export function getContainerChildPlacement(
  container: SpacePlacement,
  index: number,
  size: { width: number; height: number },
  options?: ContainerLayoutOptions
): SpacePlacement {
  const layout = resolveContainerLayout(options);
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);

  return {
    x: container.x + layout.paddingLeft + column * (size.width + layout.gapX),
    y: container.y + layout.paddingTop + row * (size.height + layout.gapY),
    width: size.width,
    height: size.height,
  };
}

export function expandContainerForChild(
  container: SpacePlacement,
  index: number,
  size: { width: number; height: number },
  options?: ContainerLayoutOptions
): SpacePlacement {
  const layout = resolveContainerLayout(options);
  const usedColumns = Math.min(layout.columns, index + 1);
  const rows = Math.floor(index / layout.columns) + 1;
  const requiredWidth =
    layout.paddingLeft +
    layout.paddingRight +
    usedColumns * size.width +
    Math.max(0, usedColumns - 1) * layout.gapX;
  const requiredHeight =
    layout.paddingTop +
    layout.paddingBottom +
    rows * size.height +
    Math.max(0, rows - 1) * layout.gapY;

  return {
    ...container,
    width: Math.max(container.width, requiredWidth),
    height: Math.max(container.height, requiredHeight),
  };
}

export function layoutContainerChild(
  container: SpacePlacement,
  index: number,
  size: { width: number; height: number },
  options?: ContainerLayoutOptions
) {
  const nextContainer = expandContainerForChild(container, index, size, options);

  return {
    container: nextContainer,
    placement: getContainerChildPlacement(nextContainer, index, size, options),
  };
}
