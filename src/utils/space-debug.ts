export function debugSpaceEvent(event: string, payload: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.debug(`[space:${event}]`, payload);
}
