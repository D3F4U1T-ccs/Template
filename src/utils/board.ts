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
  "fontFamily" | "fontSize" | "textColor" | "tone"
> = {
  fontFamily: "\"Sora\", \"Trebuchet MS\", sans-serif",
  fontSize: 32,
  textColor: "#f8fafc",
  tone: "soft",
};

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
