export type NestedGroupLike = {
  id: string;
  parentGroupId?: string | null;
  order: number;
};

export type NestedChildEntry = {
  key: string;
  parentId: string | null;
  order: number;
};

export function getDescendantGroupIds<T extends NestedGroupLike>(groups: T[], groupId: string) {
  const descendants: string[] = [];
  const queue = [groupId];

  while (queue.length) {
    const currentId = queue.shift()!;
    const children = groups.filter((group) => group.parentGroupId === currentId);

    children.forEach((child) => {
      descendants.push(child.id);
      queue.push(child.id);
    });
  }

  return descendants;
}

export function buildNestedChildIndex(entries: NestedChildEntry[]) {
  const keysByParentId = new Map<string | null, string[]>();
  const indexByKey = new Map<string, number>();
  const countByParentId = new Map<string | null, number>();

  const sortedEntries = [...entries].sort((left, right) => {
    if (left.parentId !== right.parentId) {
      return (left.parentId ?? "").localeCompare(right.parentId ?? "");
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.key.localeCompare(right.key);
  });

  sortedEntries.forEach((entry) => {
    const bucket = keysByParentId.get(entry.parentId) ?? [];
    bucket.push(entry.key);
    keysByParentId.set(entry.parentId, bucket);
  });

  keysByParentId.forEach((keys, parentId) => {
    countByParentId.set(parentId, keys.length);
    keys.forEach((key, index) => {
      indexByKey.set(key, index);
    });
  });

  return {
    keysByParentId,
    indexByKey,
    countByParentId,
  };
}
