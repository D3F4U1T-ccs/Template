import {
  FolderKanban,
  LayoutDashboard,
  Link2,
  ListTodo,
  NotepadText,
  Star,
} from "lucide-react";

import type {
  AppPageKey,
  AppSettings,
  CollectionName,
  ListFeatureConfig,
  ListFeatureKey,
} from "@/types/models";
import { nowIso } from "@/utils/entity";

export const COLLECTION_NAMES: CollectionName[] = [
  "dashboardGroups",
  "boardTexts",
  "links",
  "linkGroups",
  "taskGroups",
  "tasks",
  "lists",
  "listItems",
  "noteGroups",
  "notes",
  "files",
  "fileGroups",
  "portfolio",
];

export const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "links", label: "Links", href: "/links", icon: Link2 },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: ListTodo },
  { key: "lists", label: "Lists", href: "/lists", icon: FolderKanban },
  { key: "notes", label: "Notes", href: "/notes", icon: NotepadText },
  { key: "favorites", label: "Favorites", href: "/favorites", icon: Star },
] as const satisfies Array<{
  key: AppPageKey;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}>;

export const defaultListFeatures: ListFeatureConfig = {
  description: true,
  image: true,
  rating: true,
  watched: false,
  progress: false,
  seasonEpisode: false,
  stoppedAt: false,
  tokenCount: false,
  zeroTokenFlag: false,
  sortCheckedToBottom: false,
  tags: true,
  notes: true,
  favorite: true,
  check: false,
};

export const listFeatureOptions: Array<{
  key: ListFeatureKey;
  label: string;
  description: string;
}> = [
  { key: "description", label: "Description", description: "Short text for each entry." },
  { key: "image", label: "Image / Poster", description: "Preview, cover or thumbnail." },
  { key: "rating", label: "Decimal rating", description: "Flexible score like 3.5 or 4.0." },
  { key: "watched", label: "Watched", description: "Quick watched / not watched toggle." },
  { key: "progress", label: "Progress", description: "Track percent or episode progress." },
  { key: "seasonEpisode", label: "Season / Episode", description: "Store season and episode range." },
  { key: "stoppedAt", label: "Stopped here", description: "Human-readable stopping point." },
  { key: "tokenCount", label: "Token count", description: "Useful for AI tokens, quotas or credits." },
  { key: "zeroTokenFlag", label: "Tokens = 0", description: "Quick flag when balance is empty." },
  { key: "sortCheckedToBottom", label: "Checked to bottom", description: "Completed items sink down automatically." },
  { key: "tags", label: "Tags", description: "Store and search tags per item." },
  { key: "notes", label: "Item notes", description: "Extra contextual note field." },
  { key: "favorite", label: "Favorite", description: "Mark highlights and bring them up." },
  { key: "check", label: "Generic checkbox", description: "Simple done / tracked boolean." },
];

export const defaultSettings: AppSettings = {
  theme: "system",
  language: "ru",
  defaultPage: "dashboard",
  compactMode: false,
  canvasPattern: "dots",
  canvasOpacity: 0.9,
  updatedAt: nowIso(),
  spaceViewports: {
    "dashboard-board": { x: 0, y: 0, zoom: 1 },
    "links-board": { x: 0, y: 0, zoom: 1 },
    "tasks-board": { x: 0, y: 0, zoom: 1 },
    "lists-board": { x: 0, y: 0, zoom: 1 },
    "notes-board": { x: 0, y: 0, zoom: 1 },
    "favorites-board": { x: 0, y: 0, zoom: 1 },
  },
};

export const accentOptions = [
  "from-cyan-500/30 to-blue-500/10",
  "from-emerald-500/30 to-teal-500/10",
  "from-orange-500/30 to-amber-500/10",
  "from-rose-500/30 to-pink-500/10",
  "from-violet-500/30 to-fuchsia-500/10",
  "from-sky-500/30 to-indigo-500/10",
  "from-lime-500/30 to-emerald-500/10",
  "from-red-500/30 to-orange-500/10",
  "from-fuchsia-500/30 to-rose-500/10",
  "from-amber-500/30 to-yellow-500/10",
  "from-slate-500/35 to-zinc-900/20",
  "from-cyan-400/30 via-blue-500/15 to-violet-500/10",
  "from-emerald-400/30 via-teal-500/12 to-cyan-500/10",
];

export const boardTextFontOptions = [
  { label: "Sora", value: "\"Sora\", \"Trebuchet MS\", sans-serif" },
  { label: "Alegreya", value: "\"Alegreya\", Georgia, serif" },
  { label: "Manrope", value: "\"Manrope\", \"Segoe UI\", sans-serif" },
  { label: "Cormorant", value: "\"Cormorant Garamond\", Garamond, serif" },
  { label: "Montserrat", value: "\"Montserrat\", \"Segoe UI\", sans-serif" },
];
