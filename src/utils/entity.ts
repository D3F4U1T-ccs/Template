import type {
  BaseEntity,
  SpacePlacement,
  SpacePlacementMap,
  WorkspaceSpaceKey,
} from "@/types/models";

export function nowIso() {
  return new Date().toISOString();
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createBaseEntity(order = 1): BaseEntity {
  return {
    id: createId(),
    title: "",
    description: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    cornerRadius: 28,
    pinned: false,
    favorite: false,
    archivedAt: null,
    deletedAt: null,
    order,
    tags: [],
    lastViewedAt: null,
    spacePlacements: {},
  };
}

export function upsertEntity<T extends BaseEntity>(
  current: T | undefined,
  patch: Partial<T> & Pick<T, "title">,
  order: number
) {
  const base = createBaseEntity(order);

  return {
    ...base,
    ...current,
    ...patch,
    id: current?.id ?? patch.id ?? base.id,
    createdAt: current?.createdAt ?? patch.createdAt ?? base.createdAt,
    updatedAt: nowIso(),
    cornerRadius: patch.cornerRadius ?? current?.cornerRadius ?? base.cornerRadius,
    order: current?.order ?? patch.order ?? order,
    tags: patch.tags ?? current?.tags ?? [],
    spacePlacements:
      patch.spacePlacements ?? current?.spacePlacements ?? base.spacePlacements,
  } as T;
}

export function normalizeOrder<T extends { order: number }>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    order: index + 1,
  }));
}

export function moveEntity<T extends { id: string; order: number }>(
  items: T[],
  activeId: string,
  overId: string
) {
  const fromIndex = items.findIndex((item) => item.id === activeId);
  const toIndex = items.findIndex((item) => item.id === overId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return normalizeOrder(next);
}

export function sortByOrder<T extends BaseEntity>(items: T[]) {
  return [...items].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    return left.order - right.order;
  });
}

export function filterActive<T extends BaseEntity>(items: T[]) {
  return items.filter((item) => !item.deletedAt);
}

export function filterArchived<T extends BaseEntity>(items: T[]) {
  return items.filter((item) => !!item.archivedAt && !item.deletedAt);
}

export function nextOrder<T extends { order: number }>(items: T[]) {
  return items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
}

export function toggleArchive<T extends BaseEntity>(item: T) {
  return {
    ...item,
    archivedAt: item.archivedAt ? null : nowIso(),
    updatedAt: nowIso(),
  };
}

export function toggleFavorite<T extends BaseEntity>(item: T) {
  return {
    ...item,
    favorite: !item.favorite,
    updatedAt: nowIso(),
  };
}

export function togglePinned<T extends BaseEntity>(item: T) {
  return {
    ...item,
    pinned: !item.pinned,
    updatedAt: nowIso(),
  };
}

export function markDeleted<T extends BaseEntity>(item: T) {
  return {
    ...item,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function markViewed<T extends BaseEntity>(item: T) {
  return {
    ...item,
    lastViewedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function getSpacePlacement(
  item: Pick<BaseEntity, "spacePlacements">,
  space: WorkspaceSpaceKey,
  fallback: SpacePlacement
) {
  return item.spacePlacements?.[space] ?? fallback;
}

export function setSpacePlacement<T extends BaseEntity>(
  item: T,
  space: WorkspaceSpaceKey,
  placement: SpacePlacement
) {
  const nextPlacements: SpacePlacementMap = {
    ...(item.spacePlacements ?? {}),
    [space]: placement,
  };

  return {
    ...item,
    spacePlacements: nextPlacements,
    updatedAt: nowIso(),
  };
}
