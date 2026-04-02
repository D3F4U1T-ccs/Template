import { useEffect, useMemo, useState } from "react";

import { useAppData } from "@/hooks/use-app-data";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SpaceViewport, WorkspaceSpaceKey } from "@/types/models";

const defaultViewport: SpaceViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

export function useSpaceViewport(space: WorkspaceSpaceKey) {
  const { settings, saveWorkspaceSettings } = useAppData();
  const externalViewport = useMemo(
    () => settings.spaceViewports?.[space] ?? defaultViewport,
    [settings.spaceViewports, space]
  );
  const [viewport, setViewport] = useState<SpaceViewport>(externalViewport);

  useEffect(() => {
    setViewport((current) =>
      current.x === externalViewport.x &&
      current.y === externalViewport.y &&
      current.zoom === externalViewport.zoom
        ? current
        : externalViewport
    );
  }, [externalViewport]);

  const debouncedViewport = useDebouncedValue(viewport, 260);

  useEffect(() => {
    const changed =
      debouncedViewport.x !== externalViewport.x ||
      debouncedViewport.y !== externalViewport.y ||
      debouncedViewport.zoom !== externalViewport.zoom;

    if (!changed) {
      return;
    }

    void saveWorkspaceSettings({
      spaceViewports: {
        ...(settings.spaceViewports ?? {}),
        [space]: debouncedViewport,
      },
    });
  }, [
    debouncedViewport,
    externalViewport,
    saveWorkspaceSettings,
    settings.spaceViewports,
    space,
  ]);

  return {
    viewport,
    setViewport,
  };
}
