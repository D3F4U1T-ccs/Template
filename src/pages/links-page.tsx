import { useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { useI18n } from "@/data/i18n";
import { Modal } from "@/components/ui/modal";
import { ObjectTileCard } from "@/components/ui/object-tile-card";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
import { Badge, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { useAppData } from "@/hooks/use-app-data";
import { useSpaceViewport } from "@/hooks/use-space-viewport";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { LinkGroup, LinkItem, WorkspaceSpaceKey } from "@/types/models";
import { getFaviconUrl, normalizeUrl } from "@/utils/files";
import {
  filterActive,
  getSpacePlacement,
  markDeleted,
  nextOrder,
  setSpacePlacement,
  toggleArchive,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";

type LinkBoardData =
  | {
      kind: "link";
      link: LinkItem;
      group: LinkGroup | null;
    }
  | {
      kind: "group";
      group: LinkGroup;
      linkCount: number;
    };

const LINKS_SPACE: WorkspaceSpaceKey = "links-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;

const emptyLinkForm = {
  id: "",
  title: "",
  url: "",
  description: "",
  statusText: "",
  tags: "",
  groupId: "",
  customIconUrl: "",
  pinned: false,
  favorite: false,
};

const emptyGroupForm = {
  id: "",
  title: "",
  description: "",
  accent: accentOptions[0],
  collapsed: false,
  pinned: false,
  favorite: false,
};

export default function LinksPage() {
  const { collections, saveItem, saveMany } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(LINKS_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);

  const links = useMemo(
    () => filterActive(collections.links).filter((item) => !item.archivedAt),
    [collections.links]
  );
  const groups = useMemo(
    () => filterActive(collections.linkGroups).filter((item) => !item.archivedAt),
    [collections.linkGroups]
  );

  const groupPlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();

    groups.forEach((group, index) => {
      map.set(
        group.id,
        getSpacePlacement(
          group,
          LINKS_SPACE,
          createGridPlacement(index, {
            startX: 120,
            startY: 120,
            width: 760,
            height: 380,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        )
      );
    });

    return map;
  }, [groups]);

  const nodes = useMemo<Array<SpaceCanvasNode<LinkBoardData>>>(() => {
    const groupNodes: Array<SpaceCanvasNode<LinkBoardData>> = groups.map((group) => ({
      id: `group-${group.id}`,
      data: {
        kind: "group",
        group,
        linkCount: links.filter((link) => link.groupId === group.id).length,
      },
      placement:
        groupPlacements.get(group.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: 760,
          height: 380,
          columns: 2,
          gapX: 48,
          gapY: 48,
        }),
      resizable: true,
      minSize: {
        width: GROUP_MIN_WIDTH,
        height: GROUP_MIN_HEIGHT,
      },
      zIndex: 5,
    }));

    const groupedLinks = new Map<string | null, LinkItem[]>();

    links.forEach((link) => {
      const bucket = groupedLinks.get(link.groupId) ?? [];
      bucket.push(link);
      groupedLinks.set(link.groupId, bucket);
    });

    const linkNodes: Array<SpaceCanvasNode<LinkBoardData>> = links.map((link, index) => {
      const parentGroup = link.groupId
        ? groups.find((group) => group.id === link.groupId) ?? null
        : null;
      const siblingIndex = (groupedLinks.get(link.groupId) ?? []).findIndex(
        (entry) => entry.id === link.id
      );
      const parentPlacement = parentGroup
        ? groupPlacements.get(parentGroup.id) ??
          createGridPlacement(0, {
            startX: 120,
            startY: 120,
            width: 760,
            height: 380,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        : null;

      const fallbackPlacement = parentGroup && parentPlacement
        ? {
            x: parentPlacement.x + 28 + (siblingIndex % 3) * 236,
            y: parentPlacement.y + 84 + Math.floor(siblingIndex / 3) * 244,
            width: 208,
            height: 208,
          }
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: 208,
            height: 208,
            columns: 5,
            gapX: 28,
            gapY: 28,
          });

      return {
        id: `link-${link.id}`,
        data: {
          kind: "link",
          link,
          group: parentGroup,
        },
        placement: getSpacePlacement(link, LINKS_SPACE, fallbackPlacement),
        zIndex: 18,
      };
    });

    return [...groupNodes, ...linkNodes];
  }, [groupPlacements, groups, links]);

  function openCreateLink() {
    setLinkForm(emptyLinkForm);
    setLinkModalOpen(true);
  }

  function openEditLink(link: LinkItem) {
    setLinkForm({
      id: link.id,
      title: link.title,
      url: link.url,
      description: link.description,
      statusText: link.statusText,
      tags: link.tags.join(", "),
      groupId: link.groupId ?? "",
      customIconUrl: link.customIconUrl,
      pinned: link.pinned,
      favorite: link.favorite,
    });
    setLinkModalOpen(true);
  }

  function openCreateGroup() {
    setGroupForm({
      ...emptyGroupForm,
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
    });
    setGroupModalOpen(true);
  }

  function openEditGroup(group: LinkGroup) {
    setGroupForm({
      id: group.id,
      title: group.title,
      description: group.description,
      accent: group.accent,
      collapsed: group.collapsed,
      pinned: group.pinned,
      favorite: group.favorite,
    });
    setGroupModalOpen(true);
  }

  async function saveLinkCard() {
    const current = collections.links.find((item) => item.id === linkForm.id);
    const normalizedUrl = normalizeUrl(linkForm.url);
    const customIconUrl = linkForm.customIconUrl.trim();
    const nextLink = upsertEntity<LinkItem>(
      current,
      {
        title: linkForm.title.trim() || t("untitledLink"),
        description: linkForm.description,
        url: normalizedUrl,
        groupId: linkForm.groupId || null,
        iconUrl: customIconUrl || getFaviconUrl(normalizedUrl),
        customIconUrl,
        statusText: linkForm.statusText,
        tags: linkForm.tags.split(",").map((item) => item.trim()).filter(Boolean),
        pinned: linkForm.pinned,
        favorite: linkForm.favorite,
      },
      current?.order ?? nextOrder(collections.links)
    );

    await saveItem("links", nextLink);
    setLinkModalOpen(false);
    pushToast({
      title: current ? t("edit") : t("addLink"),
      description: t("linkSaved"),
      tone: "success",
    });
  }

  async function saveGroupCard() {
    const current = collections.linkGroups.find((item) => item.id === groupForm.id);
    const nextGroup = upsertEntity<LinkGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        accent: groupForm.accent,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.linkGroups)
    );

    await saveItem("linkGroups", nextGroup);
    setGroupModalOpen(false);
    pushToast({
      title: current ? t("edit") : t("createGroup"),
      description: t("listSaved"),
      tone: "success",
    });
  }

  async function saveLinkItem(item: LinkItem) {
    await saveItem("links", item);
  }

  async function saveGroupItem(item: LinkGroup) {
    await saveItem("linkGroups", item);
  }

  async function handleGroupPlacementCommit(
    group: LinkGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    await saveItem("linkGroups", setSpacePlacement(group, LINKS_SPACE, placement));

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;

    if (!deltaX && !deltaY) {
      return;
    }

    const movedLinks = links
      .filter((link) => link.groupId === group.id)
      .map((link) => {
        const linkPlacement = getSpacePlacement(
          link,
          LINKS_SPACE,
          createGridPlacement(0, {
            startX: placement.x + 28,
            startY: placement.y + 84,
            width: 208,
            height: 208,
          })
        );

        return setSpacePlacement(link, LINKS_SPACE, {
          ...linkPlacement,
          x: linkPlacement.x + deltaX,
          y: linkPlacement.y + deltaY,
        });
      });

    if (!movedLinks.length) {
      return;
    }

    const untouchedLinks = collections.links.filter((link) => link.groupId !== group.id);
    await saveMany("links", [...untouchedLinks, ...movedLinks]);
  }

  async function handleLinkPlacementCommit(
    link: LinkItem,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const targetGroup = groups
      .map((group) => ({
        group,
        overlap: getPlacementOverlapRatio(
          placement,
          groupPlacements.get(group.id) ??
            createGridPlacement(0, {
              startX: 120,
              startY: 120,
              width: 760,
              height: 380,
              columns: 2,
              gapX: 48,
              gapY: 48,
            })
        ),
      }))
      .sort((left, right) => right.overlap - left.overlap)
      .find((entry) => entry.overlap >= 0.5);

    await saveItem(
      "links",
      setSpacePlacement(
        {
          ...link,
          groupId: targetGroup?.group.id ?? null,
        },
        LINKS_SPACE,
        placement
      )
    );
  }

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex gap-2">
        <div className="pointer-events-auto">
          <Button className="rounded-full" onClick={openCreateGroup} variant="secondary">
            {t("createGroup")}
          </Button>
        </div>
        <div className="pointer-events-auto">
          <Button className="gap-2 rounded-full" onClick={openCreateLink}>
            <Plus className="h-4 w-4" />
            {t("addLink")}
          </Button>
        </div>
      </div>

      <SpaceCanvas
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        emptyState={
          <EmptyState
            action={
              <Button onClick={openCreateLink} variant="secondary">
                {t("addLink")}
              </Button>
            }
            description={t("linksEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "link") {
            window.open(normalizeUrl(node.data.link.url), "_blank", "noopener,noreferrer");
          }
        }}
        onPlacementCommit={(nodeId, placement) => {
          const node = nodes.find((item) => item.id === nodeId);

          if (!node) {
            return;
          }

          if (node.data.kind === "group") {
            void handleGroupPlacementCommit(node.data.group, placement);
            return;
          }

          void handleLinkPlacementCommit(node.data.link, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <LinkFrameCard
                group={groupNode.group}
                linkCount={groupNode.linkCount}
                onEdit={() => openEditGroup(groupNode.group)}
                onSave={saveGroupItem}
              />
            );
          }

          const linkNode = node.data as Extract<LinkBoardData, { kind: "link" }>;

          return (
            <LinkTileCard
              link={linkNode.link}
              onEdit={() => openEditLink(linkNode.link)}
              onSave={saveLinkItem}
            />
          );
        }}
        size={{ width: 4600, height: 2800 }}
        viewport={viewport}
      />

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setLinkModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveLinkCard()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setLinkModalOpen(false)}
        open={linkModalOpen}
        title={linkForm.id ? t("edit") : t("addLink")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderItemTitle")}
              value={linkForm.title}
            />
          </Field>
          <Field label={t("fieldUrl")}>
            <Input
              onChange={(event) => setLinkForm((current) => ({ ...current, url: event.target.value }))}
              placeholder={t("placeholderUrl")}
              value={linkForm.url}
            />
          </Field>
          <Field label={t("fieldGroup")}>
            <Select
              onChange={(event) => setLinkForm((current) => ({ ...current, groupId: event.target.value }))}
              value={linkForm.groupId}
            >
              <option value="">{t("noGroup")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fieldShortLabel")}>
            <Input
              onChange={(event) =>
                setLinkForm((current) => ({ ...current, statusText: event.target.value }))
              }
              placeholder={t("placeholderShortLabel")}
              value={linkForm.statusText}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label={t("fieldDescription")}>
              <Textarea
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t("placeholderItemDescription")}
                value={linkForm.description}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t("fieldImageUrl")}>
              <Input
                onChange={(event) =>
                  setLinkForm((current) => ({ ...current, customIconUrl: event.target.value }))
                }
                placeholder="https://icon..."
                value={linkForm.customIconUrl}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setGroupModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveGroupCard()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setGroupModalOpen(false)}
        open={groupModalOpen}
        title={groupForm.id ? t("edit") : t("createGroup")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setGroupForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderListTitle")}
              value={groupForm.title}
            />
          </Field>
          <Field label={t("fieldAccent")}>
            <Select
              onChange={(event) => setGroupForm((current) => ({ ...current, accent: event.target.value }))}
              value={groupForm.accent}
            >
              {accentOptions.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label={t("fieldDescription")}>
              <Textarea
                onChange={(event) =>
                  setGroupForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={t("placeholderListDescription")}
                value={groupForm.description}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LinkTileCard({
  link,
  onEdit,
  onSave,
}: {
  link: LinkItem;
  onEdit: () => void;
  onSave: (item: LinkItem) => Promise<void>;
}) {
  const { t } = useI18n();
  let hostname: string = t("open");

  try {
    hostname = new URL(normalizeUrl(link.url)).hostname;
  } catch {
    hostname = link.url || hostname;
  }

  return (
    <ObjectTileCard
      avatarUrl={link.customIconUrl || link.iconUrl || getFaviconUrl(link.url)}
      className="cursor-grab active:cursor-grabbing"
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-space-no-drag="true"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => window.open(normalizeUrl(link.url), "_blank", "noopener,noreferrer")}
            >
              {t("open")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(togglePinned(link))}>
              {link.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(toggleFavorite(link))}>
              {link.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(toggleArchive(link))}>
              {link.archivedAt ? t("restore") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(markDeleted(link))}>
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      subtitle={link.statusText || link.description || hostname}
      title={link.title}
    />
  );
}

function LinkFrameCard({
  group,
  linkCount,
  onEdit,
  onSave,
}: {
  group: LinkGroup;
  linkCount: number;
  onEdit: () => void;
  onSave: (item: LinkGroup) => Promise<void>;
}) {
  const { t } = useI18n();

  return (
    <CardFrameSurface accent={group.accent}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-white">{group.title}</p>
          {group.description ? (
            <p className="mt-1 truncate text-sm text-white/50">{group.description}</p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-space-no-drag="true"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal className="h-4 w-4 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(togglePinned(group))}>
              {group.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(toggleFavorite(group))}>
              {group.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(toggleArchive(group))}>
              {group.archivedAt ? t("restore") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onSave(markDeleted(group))}>
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mt-5 flex-1 rounded-[24px] border border-white/10 bg-black/72" />

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-white/52">{t("listFrameHint")}</span>
        <Badge className="border-white/10 bg-white/5 text-white/70">{linkCount}</Badge>
      </div>
    </CardFrameSurface>
  );
}

function CardFrameSurface({
  accent,
  children,
}: {
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative flex h-full min-h-0 cursor-grab flex-col overflow-hidden rounded-[28px] border border-white/10 bg-black/85 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] active:cursor-grabbing">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent} opacity-25 transition-opacity duration-200 group-hover:opacity-35`}
      />
      {children}
    </div>
  );
}
