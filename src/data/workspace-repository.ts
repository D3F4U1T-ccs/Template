import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import {
  COLLECTION_NAMES,
  defaultListFeatures,
  defaultSettings,
} from "@/data/app-config";
import { SPACE_ZOOM_MAX, SPACE_ZOOM_MIN } from "@/utils/space";
import { getFirebaseServices } from "@/data/firebase";
import { LIST_FEATURE_KEYS } from "@/types/models";
import type {
  AppPageKey,
  AppSettings,
  BaseEntity,
  BoardTextItem,
  BoardTextTone,
  CanvasPattern,
  CollectionMap,
  CollectionName,
  DashboardGroup,
  FileGroup,
  FileItem,
  FileSourceType,
  LanguageCode,
  LinkGroup,
  LinkItem,
  NoteDocument,
  NoteGroup,
  PortfolioCategory,
  PortfolioItem,
  SmartList,
  SmartListItem,
  SpacePlacement,
  SpaceViewport,
  TaskGroup,
  TaskItem,
  ThemeMode,
  WorkspaceMode,
  WorkspaceSpaceKey,
} from "@/types/models";
import { readFileAsDataUrl, sanitizeFilename } from "@/utils/files";
import { nowIso } from "@/utils/entity";

const APP_PREFIX = "twiki-control-center";
const LOCAL_EVENT = "workspace-local-change";
const SPACE_KEYS: WorkspaceSpaceKey[] = [
  "dashboard-board",
  "links-board",
  "tasks-board",
  "lists-board",
  "notes-board",
  "favorites-board",
];
const PAGE_KEYS: AppPageKey[] = [
  "dashboard",
  "links",
  "tasks",
  "lists",
  "notes",
  "favorites",
];
const THEME_MODES: ThemeMode[] = ["system", "dark", "light"];
const LANGUAGE_CODES: LanguageCode[] = ["ru", "en"];
const CANVAS_PATTERNS: CanvasPattern[] = ["dots", "grid"];
const FILE_SOURCE_TYPES: FileSourceType[] = ["upload", "link", "youtube"];
const PORTFOLIO_CATEGORIES: PortfolioCategory[] = [
  "site",
  "model3d",
  "game",
  "video",
  "other",
];
const TASK_STATUSES = ["todo", "in-progress", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_TYPES = ["day", "week", "month", "someday", "recurring"] as const;
const REPEAT_RULES = ["none", "daily", "weekly", "monthly"] as const;
const BOARD_TEXT_TONES: BoardTextTone[] = ["plain", "soft"];

function collectionPath(userId: string, collectionName: CollectionName) {
  return `users/${userId}/${collectionName}`;
}

function settingsPath(userId: string) {
  return `users/${userId}/meta/settings`;
}

function localCollectionKey(userId: string, collectionName: CollectionName) {
  return `${APP_PREFIX}:${userId}:${collectionName}`;
}

function localSettingsKey(userId: string) {
  return `${APP_PREFIX}:${userId}:settings`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function readNullableString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback = false) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(record: Record<string, unknown>, key: string, fallback = 0) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readNullableNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readStringArray(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && !!entry.trim());
}

function readEnumValue<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function normalizePlacement(value: unknown): SpacePlacement | undefined {
  const record = asRecord(value);
  const x = readNumber(record, "x", Number.NaN);
  const y = readNumber(record, "y", Number.NaN);
  const width = readNumber(record, "width", Number.NaN);
  const height = readNumber(record, "height", Number.NaN);

  if (![x, y, width, height].every(Number.isFinite)) {
    return undefined;
  }

  return {
    x,
    y,
    width: Math.max(80, width),
    height: Math.max(80, height),
  };
}

function normalizeViewport(value: unknown): SpaceViewport | undefined {
  const record = asRecord(value);
  const x = readNumber(record, "x", Number.NaN);
  const y = readNumber(record, "y", Number.NaN);
  const zoom = readNumber(record, "zoom", Number.NaN);

  if (![x, y, zoom].every(Number.isFinite)) {
    return undefined;
  }

  return {
    x,
    y,
    zoom: Math.min(Math.max(zoom, SPACE_ZOOM_MIN), SPACE_ZOOM_MAX),
  };
}

function normalizePlacementMap(value: unknown) {
  const record = asRecord(value);
  const next: Partial<Record<WorkspaceSpaceKey, SpacePlacement>> = {};

  SPACE_KEYS.forEach((spaceKey) => {
    const placement = normalizePlacement(record[spaceKey]);

    if (placement) {
      next[spaceKey] = placement;
    }
  });

  return next;
}

function normalizeViewportMap(value: unknown) {
  const record = asRecord(value);
  const next: Partial<Record<WorkspaceSpaceKey, SpaceViewport>> = {};

  SPACE_KEYS.forEach((spaceKey) => {
    const viewport = normalizeViewport(record[spaceKey]);

    if (viewport) {
      next[spaceKey] = viewport;
    }
  });

  return next;
}

function normalizeBaseEntity(id: string, value: unknown): BaseEntity {
  const record = asRecord(value);
  const createdAt = readString(record, "createdAt", nowIso());
  const updatedAt = readString(record, "updatedAt", createdAt);

  return {
    id,
    title: readString(record, "title"),
    description: readString(record, "description"),
    createdAt,
    updatedAt,
    cornerRadius: Math.min(Math.max(readNumber(record, "cornerRadius", 28), 8), 48),
    pinned: readBoolean(record, "pinned"),
    favorite: readBoolean(record, "favorite"),
    archivedAt: readNullableString(record, "archivedAt"),
    deletedAt: readNullableString(record, "deletedAt"),
    dashboardGroupId: readNullableString(record, "dashboardGroupId"),
    order: readNumber(record, "order", 1),
    tags: readStringArray(record, "tags"),
    lastViewedAt: readNullableString(record, "lastViewedAt"),
    spacePlacements: normalizePlacementMap(record.spacePlacements),
  };
}

function normalizeDashboardGroup(id: string, value: unknown): DashboardGroup {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    accent: readString(record, "accent", "from-cyan-500/30 to-blue-500/10"),
    coverUrl: readString(record, "coverUrl"),
  };
}

function normalizeLinkGroup(id: string, value: unknown): LinkGroup {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    collapsed: readBoolean(record, "collapsed"),
    accent: readString(record, "accent", "from-violet-500/30 to-fuchsia-500/10"),
  };
}

function normalizeLinkItem(id: string, value: unknown): LinkItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    url: readString(record, "url"),
    groupId: readNullableString(record, "groupId"),
    iconUrl: readString(record, "iconUrl"),
    customIconUrl: readString(record, "customIconUrl"),
    statusText: readString(record, "statusText"),
  };
}

function normalizeTaskItem(id: string, value: unknown): TaskItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    groupId: readNullableString(record, "groupId"),
    taskStatus: readEnumValue(record.taskStatus, TASK_STATUSES, "todo"),
    priority: readEnumValue(record.priority, TASK_PRIORITIES, "medium"),
    taskType: readEnumValue(record.taskType, TASK_TYPES, "day"),
    dueDate: readNullableString(record, "dueDate"),
    repeatRule: readEnumValue(record.repeatRule, REPEAT_RULES, "none"),
    completed: readBoolean(record, "completed"),
    moveToTomorrow: readBoolean(record, "moveToTomorrow"),
  };
}

function normalizeTaskGroup(id: string, value: unknown): TaskGroup {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    collapsed: readBoolean(record, "collapsed"),
    accent: readString(record, "accent", "from-emerald-500/30 to-teal-500/10"),
  };
}

function normalizeListFeatures(value: unknown) {
  const record = asRecord(value);

  return LIST_FEATURE_KEYS.reduce(
    (features, key) => ({
      ...features,
      [key]: readBoolean(record, key, defaultListFeatures[key]),
    }),
    { ...defaultListFeatures }
  );
}

function normalizeSmartList(id: string, value: unknown): SmartList {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    coverUrl: readString(record, "coverUrl"),
    listType: readString(record, "listType"),
    accent: readString(record, "accent", "from-violet-500/30 to-fuchsia-500/10"),
    features: normalizeListFeatures(record.features),
  };
}

function normalizeSmartListItem(id: string, value: unknown): SmartListItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    listId: readNullableString(record, "listId"),
    imageUrl: readString(record, "imageUrl"),
    rating: readNullableNumber(record, "rating"),
    watched: readBoolean(record, "watched"),
    progress: readNullableNumber(record, "progress"),
    season: readNullableNumber(record, "season"),
    episode: readNullableNumber(record, "episode"),
    stoppedAt: readString(record, "stoppedAt"),
    tokenCount: readNullableNumber(record, "tokenCount"),
    zeroToken: readBoolean(record, "zeroToken"),
    itemNotes: readString(record, "itemNotes"),
    checked: readBoolean(record, "checked"),
  };
}

function normalizeNoteDocument(id: string, value: unknown): NoteDocument {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    groupId: readNullableString(record, "groupId"),
    content: readString(record, "content"),
  };
}

function normalizeBoardTextItem(id: string, value: unknown): BoardTextItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    space: readEnumValue(record.space, SPACE_KEYS, "dashboard-board"),
    content: readString(record, "content"),
    fontFamily: readString(record, "fontFamily", "\"Sora\", \"Trebuchet MS\", sans-serif"),
    fontSize: Math.min(Math.max(readNumber(record, "fontSize", 28), 14), 72),
    textColor: readString(record, "textColor", "#f8fafc"),
    tone: readEnumValue(record.tone, BOARD_TEXT_TONES, "soft"),
  };
}

function normalizeNoteGroup(id: string, value: unknown): NoteGroup {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    collapsed: readBoolean(record, "collapsed"),
    accent: readString(record, "accent", "from-orange-500/30 to-amber-500/10"),
  };
}

function normalizeFileGroup(id: string, value: unknown): FileGroup {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    collapsed: readBoolean(record, "collapsed"),
    accent: readString(record, "accent", "from-cyan-500/30 to-blue-500/10"),
  };
}

function normalizeFileItem(id: string, value: unknown): FileItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    groupId: readNullableString(record, "groupId"),
    sourceType: readEnumValue(record.sourceType, FILE_SOURCE_TYPES, "link"),
    fileUrl: readString(record, "fileUrl"),
    previewUrl: readString(record, "previewUrl"),
    embedUrl: readString(record, "embedUrl"),
    mimeType: readString(record, "mimeType"),
    storagePath: readString(record, "storagePath"),
    size: readNumber(record, "size", 0),
  };
}

function normalizePortfolioItem(id: string, value: unknown): PortfolioItem {
  const record = asRecord(value);

  return {
    ...normalizeBaseEntity(id, value),
    category: readEnumValue(record.category, PORTFOLIO_CATEGORIES, "other"),
    previewUrl: readString(record, "previewUrl"),
    link: readString(record, "link"),
    status: readString(record, "status"),
  };
}

function normalizeCollectionItem<K extends CollectionName>(
  collectionName: K,
  id: string,
  value: unknown
): CollectionMap[K] {
  switch (collectionName) {
    case "dashboardGroups":
      return normalizeDashboardGroup(id, value) as CollectionMap[K];
    case "boardTexts":
      return normalizeBoardTextItem(id, value) as CollectionMap[K];
    case "links":
      return normalizeLinkItem(id, value) as CollectionMap[K];
    case "linkGroups":
      return normalizeLinkGroup(id, value) as CollectionMap[K];
    case "tasks":
      return normalizeTaskItem(id, value) as CollectionMap[K];
    case "taskGroups":
      return normalizeTaskGroup(id, value) as CollectionMap[K];
    case "lists":
      return normalizeSmartList(id, value) as CollectionMap[K];
    case "listItems":
      return normalizeSmartListItem(id, value) as CollectionMap[K];
    case "notes":
      return normalizeNoteDocument(id, value) as CollectionMap[K];
    case "noteGroups":
      return normalizeNoteGroup(id, value) as CollectionMap[K];
    case "files":
      return normalizeFileItem(id, value) as CollectionMap[K];
    case "fileGroups":
      return normalizeFileGroup(id, value) as CollectionMap[K];
    case "portfolio":
      return normalizePortfolioItem(id, value) as CollectionMap[K];
  }

  throw new Error(`Unsupported collection: ${collectionName}`);
}

function normalizeCollectionArray<K extends CollectionName>(
  collectionName: K,
  items: unknown
): CollectionMap[K][] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((entry, index) => {
    const record = asRecord(entry);
    const id = readString(record, "id", `${collectionName}-${index + 1}`);
    return normalizeCollectionItem(collectionName, id, record);
  });
}

function normalizeSettings(value: unknown): AppSettings {
  const record = asRecord(value);

  return {
    theme: readEnumValue(record.theme, THEME_MODES, defaultSettings.theme),
    language: readEnumValue(record.language, LANGUAGE_CODES, defaultSettings.language),
    defaultPage: readEnumValue(record.defaultPage, PAGE_KEYS, defaultSettings.defaultPage),
    compactMode: readBoolean(record, "compactMode", defaultSettings.compactMode),
    canvasPattern: readEnumValue(
      record.canvasPattern,
      CANVAS_PATTERNS,
      defaultSettings.canvasPattern
    ),
    canvasOpacity: Math.min(
      Math.max(readNumber(record, "canvasOpacity", defaultSettings.canvasOpacity), 0.15),
      1
    ),
    updatedAt: readString(record, "updatedAt", nowIso()),
    spaceViewports: {
      ...defaultSettings.spaceViewports,
      ...normalizeViewportMap(record.spaceViewports),
    },
  };
}

function readLocalCollection<K extends CollectionName>(userId: string, collectionName: K) {
  const raw = localStorage.getItem(localCollectionKey(userId, collectionName));

  if (!raw) {
    return [] as CollectionMap[K][];
  }

  try {
    return normalizeCollectionArray(collectionName, JSON.parse(raw));
  } catch {
    return [] as CollectionMap[K][];
  }
}

function writeLocalCollection<T>(
  userId: string,
  collectionName: CollectionName,
  items: T[]
) {
  localStorage.setItem(localCollectionKey(userId, collectionName), JSON.stringify(items));
  window.dispatchEvent(
    new CustomEvent(LOCAL_EVENT, {
      detail: { userId, collectionName },
    })
  );
}

function readLocalSettings(userId: string) {
  const raw = localStorage.getItem(localSettingsKey(userId));

  if (!raw) {
    return defaultSettings;
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings;
  }
}

function writeLocalSettings(userId: string, settings: AppSettings) {
  localStorage.setItem(localSettingsKey(userId), JSON.stringify(settings));
  window.dispatchEvent(
    new CustomEvent(LOCAL_EVENT, {
      detail: { userId, collectionName: "settings" },
    })
  );
}

export function subscribeCollection<T extends BaseEntity>(args: {
  mode: WorkspaceMode;
  userId: string;
  collectionName: CollectionName;
  onData: (items: T[]) => void;
  onError?: (message: string) => void;
}) {
  const { mode, userId, collectionName, onData, onError } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      onError?.("Firebase is not configured.");
      onData([]);
      return () => undefined;
    }

    const collectionRef = collection(services.db, collectionPath(userId, collectionName));
    const unsubscribe = onSnapshot(
      query(collectionRef),
      (snapshot) => {
        const items = snapshot.docs.map((entry) =>
          normalizeCollectionItem(collectionName, entry.id, entry.data())
        ) as unknown as T[];

        onData(items);
      },
      (error) => {
        onError?.(error.message);
      }
    );

    return unsubscribe;
  }

  const emit = () => onData(readLocalCollection(userId, collectionName) as unknown as T[]);
  const listener = (event: StorageEvent) => {
    if (event.key === localCollectionKey(userId, collectionName)) {
      emit();
    }
  };
  const localListener = (event: Event) => {
    const customEvent = event as CustomEvent<{ userId: string; collectionName: string }>;

    if (
      customEvent.detail?.userId === userId &&
      (customEvent.detail?.collectionName === collectionName ||
        customEvent.detail?.collectionName === "all")
    ) {
      emit();
    }
  };

  emit();
  window.addEventListener("storage", listener);
  window.addEventListener(LOCAL_EVENT, localListener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(LOCAL_EVENT, localListener);
  };
}

export async function saveCollectionItem<T extends BaseEntity>(args: {
  mode: WorkspaceMode;
  userId: string;
  collectionName: CollectionName;
  item: T;
}) {
  const { mode, userId, collectionName, item } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    await setDoc(doc(services.db, collectionPath(userId, collectionName), item.id), item, {
      merge: true,
    });
    return;
  }

  const items = readLocalCollection(userId, collectionName) as unknown as T[];
  const next = items.some((entry) => entry.id === item.id)
    ? items.map((entry) => (entry.id === item.id ? item : entry))
    : [...items, item];

  writeLocalCollection(userId, collectionName, next);
}

export async function saveManyCollectionItems<T extends BaseEntity>(args: {
  mode: WorkspaceMode;
  userId: string;
  collectionName: CollectionName;
  items: T[];
}) {
  const { mode, userId, collectionName, items } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    const batch = writeBatch(services.db);
    const existingSnapshot = await getDocs(
      collection(services.db, collectionPath(userId, collectionName))
    );

    existingSnapshot.docs.forEach((entry) => {
      if (!items.some((item) => item.id === entry.id)) {
        batch.delete(entry.ref);
      }
    });

    items.forEach((item) => {
      batch.set(doc(services.db, collectionPath(userId, collectionName), item.id), item);
    });

    await batch.commit();
    return;
  }

  writeLocalCollection(userId, collectionName, items);
}

export async function hardDeleteCollectionItem(args: {
  mode: WorkspaceMode;
  userId: string;
  collectionName: CollectionName;
  id: string;
}) {
  const { mode, userId, collectionName, id } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    await deleteDoc(doc(services.db, collectionPath(userId, collectionName), id));
    return;
  }

  const items = (readLocalCollection(userId, collectionName) as BaseEntity[]).filter(
    (item) => item.id !== id
  );
  writeLocalCollection(userId, collectionName, items);
}

export function subscribeSettings(args: {
  mode: WorkspaceMode;
  userId: string;
  onData: (settings: AppSettings) => void;
  onError?: (message: string) => void;
}) {
  const { mode, userId, onData, onError } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      onError?.("Firebase is not configured.");
      onData(defaultSettings);
      return () => undefined;
    }

    const settingsRef = doc(services.db, settingsPath(userId));

    return onSnapshot(
      settingsRef,
      (snapshot) => {
        onData(snapshot.exists() ? normalizeSettings(snapshot.data()) : defaultSettings);
      },
      (error) => onError?.(error.message)
    );
  }

  const emit = () => onData(readLocalSettings(userId));
  const listener = (event: StorageEvent) => {
    if (event.key === localSettingsKey(userId)) {
      emit();
    }
  };
  const localListener = (event: Event) => {
    const customEvent = event as CustomEvent<{ userId: string; collectionName: string }>;

    if (
      customEvent.detail?.userId === userId &&
      (customEvent.detail?.collectionName === "settings" ||
        customEvent.detail?.collectionName === "all")
    ) {
      emit();
    }
  };

  emit();
  window.addEventListener("storage", listener);
  window.addEventListener(LOCAL_EVENT, localListener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(LOCAL_EVENT, localListener);
  };
}

export async function saveSettings(args: {
  mode: WorkspaceMode;
  userId: string;
  settings: AppSettings;
}) {
  const { mode, userId, settings } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    await setDoc(doc(services.db, settingsPath(userId)), settings, { merge: true });
    return;
  }

  writeLocalSettings(userId, settings);
}

export async function uploadWorkspaceAsset(args: {
  mode: WorkspaceMode;
  userId: string;
  file: File;
  folder: string;
}) {
  const { mode, userId, file, folder } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    const storagePath = `users/${userId}/${folder}/${Date.now()}-${sanitizeFilename(
      file.name
    )}`;
    const storageRef = ref(services.storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    return {
      url,
      storagePath,
      size: file.size,
      mimeType: file.type,
    };
  }

  const dataUrl = await readFileAsDataUrl(file);

  return {
    url: dataUrl,
    storagePath: "",
    size: file.size,
    mimeType: file.type,
  };
}

export async function removeWorkspaceAsset(args: {
  mode: WorkspaceMode;
  storagePath: string;
}) {
  const { mode, storagePath } = args;

  if (mode !== "firebase" || !storagePath) {
    return;
  }

  const services = getFirebaseServices();

  if (!services) {
    return;
  }

  await deleteObject(ref(services.storage, storagePath));
}

export async function resetWorkspace(args: {
  mode: WorkspaceMode;
  userId: string;
}) {
  const { mode, userId } = args;

  if (mode === "firebase") {
    const services = getFirebaseServices();

    if (!services) {
      throw new Error("Firebase is not configured.");
    }

    const batch = writeBatch(services.db);

    for (const collectionName of COLLECTION_NAMES) {
      const snapshot = await getDocs(
        collection(services.db, collectionPath(userId, collectionName))
      );
      snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    }

    batch.set(doc(services.db, settingsPath(userId)), {
      ...defaultSettings,
      updatedAt: nowIso(),
    });
    await batch.commit();
    return;
  }

  COLLECTION_NAMES.forEach((collectionName) => {
    localStorage.removeItem(localCollectionKey(userId, collectionName));
  });
  localStorage.removeItem(localSettingsKey(userId));
  window.dispatchEvent(
    new CustomEvent(LOCAL_EVENT, {
      detail: { userId, collectionName: "all" },
    })
  );
}
