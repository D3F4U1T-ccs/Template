import type { SpacePlacement } from "@/types/models";

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
