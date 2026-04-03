export type ThemeMode = "dark" | "light" | "system";
export type LanguageCode = "ru" | "en";
export type CanvasPattern = "dots" | "grid";

export type AppPageKey =
  | "dashboard"
  | "links"
  | "tasks"
  | "lists"
  | "notes"
  | "favorites"
  | "files"
  | "portfolio"
  | "settings";

export type WorkspaceMode = "firebase" | "local";
export type WorkspaceSpaceKey =
  | "dashboard-board"
  | "links-board"
  | "tasks-board"
  | "lists-board"
  | "notes-board"
  | "favorites-board";

export interface SpacePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpaceViewport {
  x: number;
  y: number;
  zoom: number;
}

export type SpacePlacementMap = Partial<Record<WorkspaceSpaceKey, SpacePlacement>>;
export type SpaceViewportMap = Partial<Record<WorkspaceSpaceKey, SpaceViewport>>;

export interface BaseEntity {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  cornerRadius: number;
  pinned: boolean;
  favorite: boolean;
  archivedAt: string | null;
  deletedAt: string | null;
  dashboardGroupId?: string | null;
  order: number;
  tags: string[];
  lastViewedAt: string | null;
  spacePlacements?: SpacePlacementMap;
}

export interface DashboardGroup extends BaseEntity {
  accent: string;
  coverUrl: string;
}

export interface LinkGroup extends BaseEntity {
  collapsed: boolean;
  accent: string;
}

export interface LinkItem extends BaseEntity {
  url: string;
  groupId: string | null;
  iconUrl: string;
  customIconUrl: string;
  statusText: string;
}

export interface TaskGroup extends BaseEntity {
  collapsed: boolean;
  accent: string;
}

export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "day" | "week" | "month" | "someday" | "recurring";
export type RepeatRule = "none" | "daily" | "weekly" | "monthly";

export interface TaskItem extends BaseEntity {
  groupId: string | null;
  taskStatus: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  dueDate: string | null;
  repeatRule: RepeatRule;
  completed: boolean;
  moveToTomorrow: boolean;
}

export const LIST_FEATURE_KEYS = [
  "description",
  "image",
  "rating",
  "watched",
  "progress",
  "seasonEpisode",
  "stoppedAt",
  "tokenCount",
  "zeroTokenFlag",
  "sortCheckedToBottom",
  "tags",
  "notes",
  "favorite",
  "check",
] as const;

export type ListFeatureKey = (typeof LIST_FEATURE_KEYS)[number];

export type ListFeatureConfig = Record<ListFeatureKey, boolean>;

export interface SmartList extends BaseEntity {
  coverUrl: string;
  listType: string;
  accent: string;
  features: ListFeatureConfig;
}

export interface SmartListItem extends BaseEntity {
  listId: string | null;
  imageUrl: string;
  rating: number | null;
  watched: boolean;
  progress: number | null;
  season: number | null;
  episode: number | null;
  stoppedAt: string;
  tokenCount: number | null;
  zeroToken: boolean;
  itemNotes: string;
  checked: boolean;
}

export interface NoteGroup extends BaseEntity {
  collapsed: boolean;
  accent: string;
}

export interface NoteDocument extends BaseEntity {
  groupId: string | null;
  content: string;
}

export type BoardTextTone = "plain" | "solid" | "glass";

export interface BoardTextItem extends BaseEntity {
  space: WorkspaceSpaceKey;
  content: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  tone: BoardTextTone;
}

export interface FileGroup extends BaseEntity {
  collapsed: boolean;
  accent: string;
}

export type FileSourceType = "upload" | "link" | "youtube";

export interface FileItem extends BaseEntity {
  groupId: string | null;
  sourceType: FileSourceType;
  fileUrl: string;
  previewUrl: string;
  embedUrl: string;
  mimeType: string;
  storagePath: string;
  size: number;
}

export type PortfolioCategory = "site" | "model3d" | "game" | "video" | "other";

export interface PortfolioItem extends BaseEntity {
  category: PortfolioCategory;
  previewUrl: string;
  link: string;
  status: string;
}

export type CollectionName =
  | "dashboardGroups"
  | "boardTexts"
  | "links"
  | "linkGroups"
  | "taskGroups"
  | "tasks"
  | "lists"
  | "listItems"
  | "noteGroups"
  | "notes"
  | "files"
  | "fileGroups"
  | "portfolio";

export interface CollectionMap {
  dashboardGroups: DashboardGroup;
  boardTexts: BoardTextItem;
  links: LinkItem;
  linkGroups: LinkGroup;
  taskGroups: TaskGroup;
  tasks: TaskItem;
  lists: SmartList;
  listItems: SmartListItem;
  noteGroups: NoteGroup;
  notes: NoteDocument;
  files: FileItem;
  fileGroups: FileGroup;
  portfolio: PortfolioItem;
}

export interface AppSettings {
  theme: ThemeMode;
  language: LanguageCode;
  defaultPage: AppPageKey;
  compactMode: boolean;
  canvasPattern: CanvasPattern;
  canvasOpacity: number;
  updatedAt: string;
  spaceViewports?: SpaceViewportMap;
}

export interface UserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo: boolean;
}

export interface WorkspaceExport {
  version: number;
  exportedAt: string;
  dashboardGroups: DashboardGroup[];
  boardTexts: BoardTextItem[];
  links: LinkItem[];
  linkGroups: LinkGroup[];
  taskGroups: TaskGroup[];
  tasks: TaskItem[];
  lists: SmartList[];
  listItems: SmartListItem[];
  noteGroups: NoteGroup[];
  notes: NoteDocument[];
  files: FileItem[];
  fileGroups: FileGroup[];
  portfolio: PortfolioItem[];
  settings: AppSettings;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  section: string;
  keywords?: string[];
}
