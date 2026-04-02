export function tokenize(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function matchesQuery(
  query: string,
  values: Array<string | string[] | null | undefined>
) {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = values
    .flatMap((value) => (Array.isArray(value) ? value : [value ?? ""]))
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function filterByQuery<T>(
  items: T[],
  query: string,
  pick: (item: T) => Array<string | string[] | null | undefined>
) {
  if (!query.trim()) {
    return items;
  }

  return items.filter((item) => matchesQuery(query, pick(item)));
}
