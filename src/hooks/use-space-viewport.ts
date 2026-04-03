import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppData } from "@/hooks/use-app-data";
import type { SpaceViewport, WorkspaceSpaceKey } from "@/types/models";
import { debugSpaceEvent } from "@/utils/space-debug";

const defaultViewport: SpaceViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

const SAVE_DELAY_MS = 520;

function isSameViewport(left: SpaceViewport, right: SpaceViewport) {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

export function useSpaceViewport(space: WorkspaceSpaceKey) {
  const { settings, saveWorkspaceSettings } = useAppData();
  const externalViewport = useMemo(
    () => settings.spaceViewports?.[space] ?? defaultViewport,
    [settings.spaceViewports, space]
  );
  const [viewport, setViewportState] = useState<SpaceViewport>(externalViewport);
  const pendingViewportRef = useRef<SpaceViewport | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const setViewport = useCallback((next: SpaceViewport) => {
    pendingViewportRef.current = next;
    debugSpaceEvent("viewport-local", {
      space,
      x: next.x,
      y: next.y,
      zoom: next.zoom,
    });
    setViewportState((current) => (isSameViewport(current, next) ? current : next));
  }, [space]);

  useEffect(() => {
    const pendingViewport = pendingViewportRef.current;

    if (pendingViewport) {
      if (isSameViewport(externalViewport, pendingViewport)) {
        pendingViewportRef.current = null;
      } else {
        return;
      }
    }

    setViewportState((current) =>
      isSameViewport(current, externalViewport) ? current : externalViewport
    );
  }, [externalViewport]);

  useEffect(() => {
    if (!pendingViewportRef.current || isSameViewport(viewport, externalViewport)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const pendingViewport = pendingViewportRef.current ?? viewport;

      debugSpaceEvent("viewport-save", {
        space,
        x: pendingViewport.x,
        y: pendingViewport.y,
        zoom: pendingViewport.zoom,
      });

      void saveWorkspaceSettings({
        spaceViewports: {
          ...(settingsRef.current.spaceViewports ?? {}),
          [space]: pendingViewport,
        },
      });
    }, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    externalViewport,
    saveWorkspaceSettings,
    settings.spaceViewports,
    space,
    viewport,
  ]);

  return {
    viewport,
    setViewport,
  };
}
