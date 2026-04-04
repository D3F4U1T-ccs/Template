import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { defaultSettings } from "@/data/app-config";
import {
  hardDeleteCollectionItem,
  removeWorkspaceAsset,
  resetWorkspace as resetWorkspaceRepo,
  saveCollectionItem,
  saveManyCollectionItems,
  saveSettings,
  subscribeCollection,
  subscribeSettings,
  uploadWorkspaceAsset,
} from "@/data/workspace-repository";
import { useAuth } from "@/hooks/use-auth";
import type {
  AppSettings,
  BaseEntity,
  CollectionMap,
  CollectionName,
  WorkspaceExport,
} from "@/types/models";
import { downloadJson } from "@/utils/files";
import { nowIso, sortByOrder } from "@/utils/entity";

type WorkspaceContextValue = {
  mode: "firebase" | "local";
  collections: {
    dashboardGroups: CollectionMap["dashboardGroups"][];
    boardTexts: CollectionMap["boardTexts"][];
    links: CollectionMap["links"][];
    linkGroups: CollectionMap["linkGroups"][];
    taskGroups: CollectionMap["taskGroups"][];
    tasks: CollectionMap["tasks"][];
    lists: CollectionMap["lists"][];
    listItems: CollectionMap["listItems"][];
    noteGroups: CollectionMap["noteGroups"][];
    notes: CollectionMap["notes"][];
    files: CollectionMap["files"][];
    fileGroups: CollectionMap["fileGroups"][];
    portfolio: CollectionMap["portfolio"][];
  };
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  syncIssue: string | null;
  saveItem: <K extends CollectionName>(
    collectionName: K,
    item: CollectionMap[K]
  ) => Promise<void>;
  saveMany: <K extends CollectionName>(
    collectionName: K,
    items: CollectionMap[K][]
  ) => Promise<void>;
  hardDelete: <K extends CollectionName>(collectionName: K, id: string) => Promise<void>;
  saveWorkspaceSettings: (patch: Partial<AppSettings>) => Promise<void>;
  uploadAsset: (file: File, folder: string) => Promise<{
    url: string;
    storagePath: string;
    size: number;
    mimeType: string;
  }>;
  removeAsset: (storagePath: string) => Promise<void>;
  exportWorkspace: () => void;
  importWorkspace: (file: File) => Promise<void>;
  resetWorkspace: () => Promise<void>;
};

export const AppDataContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

function useCollectionState<T extends BaseEntity>(
  collectionName: CollectionName,
  userId: string | undefined,
  mode: "firebase" | "local"
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      hasLoadedRef.current = false;
      setItems([]);
      setLoading(false);
      return;
    }

    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    return subscribeCollection<T>({
      mode,
      userId,
      collectionName,
      onData: (nextItems) => {
        hasLoadedRef.current = true;
        setItems(sortByOrder(nextItems));
        setLoading(false);
      },
      onError: (message) => {
        hasLoadedRef.current = true;
        setError(message);
        setLoading(false);
      },
    });
  }, [collectionName, mode, userId]);

  return { items, setItems, loading, error };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth();
  const userId = user?.uid;

  const dashboardGroupsState = useCollectionState<CollectionMap["dashboardGroups"]>(
    "dashboardGroups",
    userId,
    mode
  );
  const boardTextsState = useCollectionState<CollectionMap["boardTexts"]>(
    "boardTexts",
    userId,
    mode
  );
  const linksState = useCollectionState<CollectionMap["links"]>("links", userId, mode);
  const linkGroupsState = useCollectionState<CollectionMap["linkGroups"]>(
    "linkGroups",
    userId,
    mode
  );
  const taskGroupsState = useCollectionState<CollectionMap["taskGroups"]>(
    "taskGroups",
    userId,
    mode
  );
  const tasksState = useCollectionState<CollectionMap["tasks"]>("tasks", userId, mode);
  const listsState = useCollectionState<CollectionMap["lists"]>("lists", userId, mode);
  const listItemsState = useCollectionState<CollectionMap["listItems"]>(
    "listItems",
    userId,
    mode
  );
  const noteGroupsState = useCollectionState<CollectionMap["noteGroups"]>(
    "noteGroups",
    userId,
    mode
  );
  const notesState = useCollectionState<CollectionMap["notes"]>("notes", userId, mode);
  const filesState = useCollectionState<CollectionMap["files"]>("files", userId, mode);
  const fileGroupsState = useCollectionState<CollectionMap["fileGroups"]>(
    "fileGroups",
    userId,
    mode
  );
  const portfolioState = useCollectionState<CollectionMap["portfolio"]>(
    "portfolio",
    userId,
    mode
  );

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const settingsLoadedRef = useRef(false);

  const applySingleItemUpdate = useCallback(
    <K extends CollectionName>(collectionName: K, item: CollectionMap[K]) => {
      switch (collectionName) {
        case "dashboardGroups":
          dashboardGroupsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id
                      ? (item as CollectionMap["dashboardGroups"])
                      : entry
                  )
                : [...current, item as CollectionMap["dashboardGroups"]]
            )
          );
          return;
        case "boardTexts":
          boardTextsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["boardTexts"]) : entry
                  )
                : [...current, item as CollectionMap["boardTexts"]]
            )
          );
          return;
        case "links":
          linksState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["links"]) : entry
                  )
                : [...current, item as CollectionMap["links"]]
            )
          );
          return;
        case "linkGroups":
          linkGroupsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["linkGroups"]) : entry
                  )
                : [...current, item as CollectionMap["linkGroups"]]
            )
          );
          return;
        case "tasks":
          tasksState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["tasks"]) : entry
                  )
                : [...current, item as CollectionMap["tasks"]]
            )
          );
          return;
        case "taskGroups":
          taskGroupsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["taskGroups"]) : entry
                  )
                : [...current, item as CollectionMap["taskGroups"]]
            )
          );
          return;
        case "lists":
          listsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["lists"]) : entry
                  )
                : [...current, item as CollectionMap["lists"]]
            )
          );
          return;
        case "listItems":
          listItemsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["listItems"]) : entry
                  )
                : [...current, item as CollectionMap["listItems"]]
            )
          );
          return;
        case "notes":
          notesState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["notes"]) : entry
                  )
                : [...current, item as CollectionMap["notes"]]
            )
          );
          return;
        case "noteGroups":
          noteGroupsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["noteGroups"]) : entry
                  )
                : [...current, item as CollectionMap["noteGroups"]]
            )
          );
          return;
        case "files":
          filesState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["files"]) : entry
                  )
                : [...current, item as CollectionMap["files"]]
            )
          );
          return;
        case "fileGroups":
          fileGroupsState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["fileGroups"]) : entry
                  )
                : [...current, item as CollectionMap["fileGroups"]]
            )
          );
          return;
        case "portfolio":
          portfolioState.setItems((current) =>
            sortByOrder(
              current.some((entry) => entry.id === item.id)
                ? current.map((entry) =>
                    entry.id === item.id ? (item as CollectionMap["portfolio"]) : entry
                  )
                : [...current, item as CollectionMap["portfolio"]]
            )
          );
          return;
      }
    },
    [
      boardTextsState,
      dashboardGroupsState,
      fileGroupsState,
      filesState,
      linkGroupsState,
      linksState,
      listItemsState,
      listsState,
      noteGroupsState,
      notesState,
      portfolioState,
      taskGroupsState,
      tasksState,
    ]
  );

  const replaceCollectionItems = useCallback(
    <K extends CollectionName>(collectionName: K, items: CollectionMap[K][]) => {
      switch (collectionName) {
        case "dashboardGroups":
          dashboardGroupsState.setItems(
            sortByOrder(items as CollectionMap["dashboardGroups"][])
          );
          return;
        case "boardTexts":
          boardTextsState.setItems(sortByOrder(items as CollectionMap["boardTexts"][]));
          return;
        case "links":
          linksState.setItems(sortByOrder(items as CollectionMap["links"][]));
          return;
        case "linkGroups":
          linkGroupsState.setItems(sortByOrder(items as CollectionMap["linkGroups"][]));
          return;
        case "tasks":
          tasksState.setItems(sortByOrder(items as CollectionMap["tasks"][]));
          return;
        case "taskGroups":
          taskGroupsState.setItems(sortByOrder(items as CollectionMap["taskGroups"][]));
          return;
        case "lists":
          listsState.setItems(sortByOrder(items as CollectionMap["lists"][]));
          return;
        case "listItems":
          listItemsState.setItems(sortByOrder(items as CollectionMap["listItems"][]));
          return;
        case "notes":
          notesState.setItems(sortByOrder(items as CollectionMap["notes"][]));
          return;
        case "noteGroups":
          noteGroupsState.setItems(sortByOrder(items as CollectionMap["noteGroups"][]));
          return;
        case "files":
          filesState.setItems(sortByOrder(items as CollectionMap["files"][]));
          return;
        case "fileGroups":
          fileGroupsState.setItems(sortByOrder(items as CollectionMap["fileGroups"][]));
          return;
        case "portfolio":
          portfolioState.setItems(sortByOrder(items as CollectionMap["portfolio"][]));
          return;
      }
    },
    [
      boardTextsState,
      dashboardGroupsState,
      fileGroupsState,
      filesState,
      linkGroupsState,
      linksState,
      listItemsState,
      listsState,
      noteGroupsState,
      notesState,
      portfolioState,
      taskGroupsState,
      tasksState,
    ]
  );

  useEffect(() => {
    if (!userId) {
      settingsLoadedRef.current = false;
      setSettings(defaultSettings);
      setSettingsLoading(false);
      return;
    }

    if (!settingsLoadedRef.current) {
      setSettingsLoading(true);
    }
    setSettingsError(null);

    return subscribeSettings({
      mode,
      userId,
      onData: (nextSettings) => {
        settingsLoadedRef.current = true;
        setSettings(nextSettings);
        setSettingsLoading(false);
      },
      onError: (message) => {
        settingsLoadedRef.current = true;
        setSettingsError(message);
        setSettingsLoading(false);
      },
    });
  }, [mode, userId]);

  const saveItem = useCallback(
    async <K extends CollectionName>(collectionName: K, item: CollectionMap[K]) => {
      if (!userId) {
        return;
      }

      applySingleItemUpdate(collectionName, item);
      setSyncIssue(null);

      try {
        await saveCollectionItem({
          mode,
          userId,
          collectionName,
          item,
        });
      } catch (error) {
        setSyncIssue(error instanceof Error ? error.message : "Failed to sync this change.");
      }
    },
    [
      applySingleItemUpdate,
      mode,
      userId,
    ]
  );

  const saveMany = useCallback(
    async <K extends CollectionName>(collectionName: K, items: CollectionMap[K][]) => {
      if (!userId) {
        return;
      }

      replaceCollectionItems(collectionName, items);
      setSyncIssue(null);

      try {
        await saveManyCollectionItems({
          mode,
          userId,
          collectionName,
          items,
        });
      } catch (error) {
        setSyncIssue(error instanceof Error ? error.message : "Failed to sync these changes.");
      }
    },
    [
      mode,
      replaceCollectionItems,
      userId,
    ]
  );

  const getCollectionItems = useCallback(
    <K extends CollectionName>(collectionName: K): CollectionMap[K][] => {
      switch (collectionName) {
        case "dashboardGroups":
          return dashboardGroupsState.items as CollectionMap[K][];
        case "boardTexts":
          return boardTextsState.items as CollectionMap[K][];
        case "links":
          return linksState.items as CollectionMap[K][];
        case "linkGroups":
          return linkGroupsState.items as CollectionMap[K][];
        case "tasks":
          return tasksState.items as CollectionMap[K][];
        case "taskGroups":
          return taskGroupsState.items as CollectionMap[K][];
        case "lists":
          return listsState.items as CollectionMap[K][];
        case "listItems":
          return listItemsState.items as CollectionMap[K][];
        case "notes":
          return notesState.items as CollectionMap[K][];
        case "noteGroups":
          return noteGroupsState.items as CollectionMap[K][];
        case "files":
          return filesState.items as CollectionMap[K][];
        case "fileGroups":
          return fileGroupsState.items as CollectionMap[K][];
        case "portfolio":
          return portfolioState.items as CollectionMap[K][];
      }

      throw new Error(`Unsupported collection: ${collectionName satisfies never}`);
    },
    [
      boardTextsState.items,
      dashboardGroupsState.items,
      fileGroupsState.items,
      filesState.items,
      linkGroupsState.items,
      linksState.items,
      listItemsState.items,
      listsState.items,
      noteGroupsState.items,
      notesState.items,
      portfolioState.items,
      taskGroupsState.items,
      tasksState.items,
    ]
  );

  const collectionsLoading =
    dashboardGroupsState.loading ||
    boardTextsState.loading ||
    linksState.loading ||
    linkGroupsState.loading ||
    taskGroupsState.loading ||
    tasksState.loading ||
    listsState.loading ||
    listItemsState.loading ||
    noteGroupsState.loading ||
    notesState.loading ||
    filesState.loading ||
    fileGroupsState.loading ||
    portfolioState.loading;

  const cleanupUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      cleanupUserRef.current = null;
      return;
    }

    if (collectionsLoading || cleanupUserRef.current === userId) {
      return;
    }

    cleanupUserRef.current = userId;

    const cleanupTargets = [
      ["dashboardGroups", dashboardGroupsState.items],
      ["boardTexts", boardTextsState.items],
      ["links", linksState.items],
      ["linkGroups", linkGroupsState.items],
      ["taskGroups", taskGroupsState.items],
      ["tasks", tasksState.items],
      ["lists", listsState.items],
      ["listItems", listItemsState.items],
      ["noteGroups", noteGroupsState.items],
      ["notes", notesState.items],
      ["files", filesState.items],
      ["fileGroups", fileGroupsState.items],
      ["portfolio", portfolioState.items],
    ] as const satisfies Array<[CollectionName, BaseEntity[]]>;

    const jobs = cleanupTargets
      .filter(([, items]) => items.some((item) => item.deletedAt || item.archivedAt))
      .map(([collectionName, items]) =>
        saveMany(
          collectionName,
          items.filter((item) => !item.deletedAt && !item.archivedAt) as never[]
        )
      );

    if (jobs.length) {
      void Promise.all(jobs);
    }
  }, [
    boardTextsState.items,
    dashboardGroupsState.items,
    fileGroupsState.items,
    filesState.items,
    linkGroupsState.items,
    linksState.items,
    listItemsState.items,
    listsState.items,
    collectionsLoading,
    noteGroupsState.items,
    notesState.items,
    portfolioState.items,
    saveMany,
    taskGroupsState.items,
    tasksState.items,
    userId,
  ]);

  const hardDelete = useCallback(
    async <K extends CollectionName>(collectionName: K, id: string) => {
      if (!userId) {
        return;
      }

      const currentItems = getCollectionItems(collectionName);
      replaceCollectionItems(
        collectionName,
        currentItems.filter((item) => item.id !== id) as CollectionMap[K][]
      );
      setSyncIssue(null);

      try {
        await hardDeleteCollectionItem({
          mode,
          userId,
          collectionName,
          id,
        });
      } catch (error) {
        replaceCollectionItems(collectionName, currentItems);
        setSyncIssue(error instanceof Error ? error.message : "Failed to delete this item.");
      }
    },
    [getCollectionItems, mode, replaceCollectionItems, userId]
  );

  const saveWorkspaceSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!userId) {
        return;
      }

      const nextSettings: AppSettings = {
        ...settings,
        ...patch,
        updatedAt: nowIso(),
      };

      setSettings(nextSettings);
      setSyncIssue(null);

      try {
        await saveSettings({
          mode,
          userId,
          settings: nextSettings,
        });
      } catch (error) {
        setSyncIssue(error instanceof Error ? error.message : "Failed to sync settings.");
      }
    },
    [mode, settings, userId]
  );

  const uploadAsset = useCallback(
    async (file: File, folder: string) => {
      if (!userId) {
        throw new Error("No active user session.");
      }

      return uploadWorkspaceAsset({
        mode,
        userId,
        file,
        folder,
      });
    },
    [mode, userId]
  );

  const removeAsset = useCallback(
    async (storagePath: string) => {
      await removeWorkspaceAsset({
        mode,
        storagePath,
      });
    },
    [mode]
  );

  const collections = useMemo(
    () => ({
      dashboardGroups: dashboardGroupsState.items,
      boardTexts: boardTextsState.items,
      links: linksState.items,
      linkGroups: linkGroupsState.items,
      taskGroups: taskGroupsState.items,
      tasks: tasksState.items,
      lists: listsState.items,
      listItems: listItemsState.items,
      noteGroups: noteGroupsState.items,
      notes: notesState.items,
      files: filesState.items,
      fileGroups: fileGroupsState.items,
      portfolio: portfolioState.items,
    }),
    [
      boardTextsState.items,
      dashboardGroupsState.items,
      fileGroupsState.items,
      filesState.items,
      linkGroupsState.items,
      linksState.items,
      listItemsState.items,
      listsState.items,
      noteGroupsState.items,
      notesState.items,
      portfolioState.items,
      taskGroupsState.items,
      tasksState.items,
    ]
  );

  const exportWorkspace = useCallback(() => {
    const payload: WorkspaceExport = {
      version: 1,
      exportedAt: nowIso(),
      dashboardGroups: collections.dashboardGroups,
      boardTexts: collections.boardTexts,
      links: collections.links,
      linkGroups: collections.linkGroups,
      taskGroups: collections.taskGroups,
      tasks: collections.tasks,
      lists: collections.lists,
      listItems: collections.listItems,
      noteGroups: collections.noteGroups,
      notes: collections.notes,
      files: collections.files,
      fileGroups: collections.fileGroups,
      portfolio: collections.portfolio,
      settings,
    };

    downloadJson("workspace-backup.json", payload);
  }, [collections, settings]);

  const importWorkspace = useCallback(
    async (file: File) => {
      if (!userId) {
        return;
      }

      const raw = await file.text();
      const payload = JSON.parse(raw) as Partial<WorkspaceExport>;

      await Promise.all([
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "dashboardGroups",
          items: Array.isArray(payload.dashboardGroups) ? payload.dashboardGroups : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "boardTexts",
          items: Array.isArray(payload.boardTexts) ? payload.boardTexts : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "links",
          items: Array.isArray(payload.links) ? payload.links : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "linkGroups",
          items: Array.isArray(payload.linkGroups) ? payload.linkGroups : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "taskGroups",
          items: Array.isArray(payload.taskGroups) ? payload.taskGroups : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "tasks",
          items: Array.isArray(payload.tasks) ? payload.tasks : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "lists",
          items: Array.isArray(payload.lists) ? payload.lists : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "listItems",
          items: Array.isArray(payload.listItems) ? payload.listItems : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "noteGroups",
          items: Array.isArray(payload.noteGroups) ? payload.noteGroups : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "notes",
          items: Array.isArray(payload.notes) ? payload.notes : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "files",
          items: Array.isArray(payload.files) ? payload.files : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "fileGroups",
          items: Array.isArray(payload.fileGroups) ? payload.fileGroups : [],
        }),
        saveManyCollectionItems({
          mode,
          userId,
          collectionName: "portfolio",
          items: Array.isArray(payload.portfolio) ? payload.portfolio : [],
        }),
      ]);

      await saveSettings({
        mode,
        userId,
        settings: {
          ...defaultSettings,
          ...(payload.settings ?? {}),
          updatedAt: nowIso(),
        },
      });
    },
    [mode, userId]
  );

  const resetWorkspace = useCallback(async () => {
    if (!userId) {
      return;
    }

    await resetWorkspaceRepo({
      mode,
      userId,
    });
  }, [mode, userId]);

  const loading = collectionsLoading || settingsLoading;

  const error =
    dashboardGroupsState.error ??
    boardTextsState.error ??
    linksState.error ??
    linkGroupsState.error ??
    taskGroupsState.error ??
    tasksState.error ??
    listsState.error ??
    listItemsState.error ??
    noteGroupsState.error ??
    notesState.error ??
    filesState.error ??
    fileGroupsState.error ??
    portfolioState.error ??
    settingsError;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      mode,
      collections,
      settings,
      loading,
      error,
      syncIssue,
      saveItem,
      saveMany,
      hardDelete,
      saveWorkspaceSettings,
      uploadAsset,
      removeAsset,
      exportWorkspace,
      importWorkspace,
      resetWorkspace,
    }),
    [
      collections,
      error,
      exportWorkspace,
      hardDelete,
      importWorkspace,
      loading,
      mode,
      removeAsset,
      resetWorkspace,
      saveItem,
      saveMany,
      saveWorkspaceSettings,
      settings,
      syncIssue,
      uploadAsset,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
