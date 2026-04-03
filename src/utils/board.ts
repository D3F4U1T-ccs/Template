import type {
  AppSettings,
  BaseEntity,
  BoardTextItem,
  SpacePlacement,
  SpaceViewport,
  WorkspaceSpaceKey,
} from "@/types/models";
import { ensureSpacePlacement } from "@/utils/entity";
import {
  createPlacementAtViewportCenter,
  layoutContainerChild,
} from "@/utils/space";

export const LINK_GROUP_LAYOUT = {
  columns: 3,
  gapX: 28,
  gapY: 36,
  paddingTop: 84,
  paddingBottom: 28,
  paddingLeft: 28,
  paddingRight: 28,
};

export const TASK_GROUP_LAYOUT = {
  columns: 2,
  gapX: 28,
  gapY: 28,
  paddingTop: 84,
  paddingBottom: 28,
  paddingLeft: 28,
  paddingRight: 28,
};

export const LIST_FRAME_LAYOUT = {
  columns: 3,
  gapX: 28,
  gapY: 32,
  paddingTop: 84,
  paddingBottom: 28,
  paddingLeft: 28,
  paddingRight: 28,
};

export const DEFAULT_TEXT_SIZE = {
  width: 420,
  height: 240,
};

export const DEFAULT_TEXT_STYLE: Pick<
  BoardTextItem,
  "fontFamily" | "fontSize" | "textColor" | "backgroundColor" | "tone"
> = {
  fontFamily: "\"Sora\", \"Trebuchet MS\", sans-serif",
  fontSize: 32,
  textColor: "#f8fafc",
  backgroundColor: "#1d4ed8",
  tone: "plain",
};

let textMeasureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string
) {
  if (typeof document === "undefined") {
    return Math.max(text.length * fontSize * 0.58, fontSize * 0.9);
  }

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");

  if (!context) {
    return Math.max(text.length * fontSize * 0.58, fontSize * 0.9);
  }

  context.font = `${fontSize}px ${fontFamily}`;

  return context.measureText(text || " ").width;
}

export function getBoardTextPlacementSize(
  item: Pick<BoardTextItem, "content" | "fontFamily" | "fontSize" | "tone">
) {
  const lines = (item.content || "").split("\n");
  const safeLines = lines.length ? lines : [""];
  const maxContentWidth = item.tone === "plain" ? 720 : 640;
  const paddingX = item.tone === "plain" ? 8 : 32;
  const paddingY = item.tone === "plain" ? 6 : 24;
  const minWidth = item.tone === "plain" ? 96 : 160;
  const minHeight = item.tone === "plain" ? Math.max(42, item.fontSize + 10) : 72;
  let visualRows = 0;
  let widestLine = 0;

  safeLines.forEach((line) => {
    const lineWidth = measureTextWidth(line || " ", item.fontSize, item.fontFamily);
    const wrappedRows = Math.max(1, Math.ceil(lineWidth / Math.max(maxContentWidth, 1)));

    visualRows += wrappedRows;
    widestLine = Math.max(widestLine, Math.min(lineWidth, maxContentWidth));
  });

  return {
    width: Math.ceil(Math.max(minWidth, widestLine + paddingX * 2)),
    height: Math.ceil(
      Math.max(minHeight, visualRows * item.fontSize * 1.15 + paddingY * 2)
    ),
  };
}

export function ensureEntityCenteredInSpace<T extends BaseEntity>(
  item: T,
  space: WorkspaceSpaceKey,
  viewport: SpaceViewport,
  size: { width: number; height: number }
) {
  return ensureSpacePlacement(
    item,
    space,
    createPlacementAtViewportCenter(viewport, size)
  );
}

export function createContainerPlacement(
  container: SpacePlacement,
  itemIndex: number,
  size: { width: number; height: number },
  layout: Parameters<typeof layoutContainerChild>[3]
) {
  return layoutContainerChild(container, itemIndex, size, layout);
}

export function ensureShortcutBoardPlacements<T extends BaseEntity>(
  item: T,
  settings: Pick<AppSettings, "spaceViewports">,
  size: { width: number; height: number }
) {
  let nextItem = item;
  const dashboardViewport = settings.spaceViewports?.["dashboard-board"];
  const favoritesViewport = settings.spaceViewports?.["favorites-board"];

  if (item.pinned && dashboardViewport) {
    nextItem = ensureEntityCenteredInSpace(
      nextItem,
      "dashboard-board",
      dashboardViewport,
      size
    );
  }

  if (item.favorite && favoritesViewport) {
    nextItem = ensureEntityCenteredInSpace(
      nextItem,
      "favorites-board",
      favoritesViewport,
      size
    );
  }

  return nextItem;
}

export function getFontSizeFromResize(args: {
  currentFontSize: number;
  origin: SpacePlacement;
  preview: SpacePlacement;
  min?: number;
  max?: number;
}) {
  const { currentFontSize, origin, preview, min = 14, max = 96 } = args;
  const widthRatio = preview.width / Math.max(origin.width, 1);
  const heightRatio = preview.height / Math.max(origin.height, 1);
  const scale = Math.max(widthRatio, heightRatio);

  return Math.min(Math.max(Math.round(currentFontSize * scale), min), max);
}
