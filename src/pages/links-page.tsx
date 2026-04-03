import { useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import {
  BoardTextEditorModal,
  type BoardTextFormState,
} from "@/components/ui/board-text-editor-modal";
import { useI18n } from "@/data/i18n";
import { Modal } from "@/components/ui/modal";
import { CanvasFrame } from "@/components/ui/canvas-frame";
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
import type {
  BoardTextItem,
  LinkGroup,
  LinkItem,
  WorkspaceSpaceKey,
} from "@/types/models";
import { getFaviconUrl, normalizeUrl } from "@/utils/files";
import {
  filterActive,
  getSpacePlacement,
  nextOrder,
  setSpacePlacement,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import {
  DEFAULT_TEXT_SIZE,
  DEFAULT_TEXT_STYLE,
  LINK_GROUP_LAYOUT,
  createContainerPlacement,
  ensureEntityCenteredInSpace,
  ensureShortcutBoardPlacements,
} from "@/utils/board";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";

type LinkBoardData =
  | {
      kind: "link";
      link: LinkItem;
      group: LinkGroup | null;
    }
  | {
      kind: "text";
      text: BoardTextItem;
    }
  | {
      kind: "group";
      group: LinkGroup;
      linkCount: number;
    };

const LINKS_SPACE: WorkspaceSpaceKey = "links-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;
const LINK_TILE_SIZE = {
  width: 208,
  height: 208,
};
const GROUP_DEFAULT_SIZE = {
  width: 760,
  height: 380,
};

const emptyLinkForm = {
  id: "",
  title: "",
  url: "",
  description: "",
  statusText: "",
  tags: "",
  groupId: "",
  customIconUrl: "",
  cornerRadius: 26,
  pinned: false,
  favorite: false,
};

const emptyGroupForm = {
  id: "",
  title: "",
  description: "",
  accent: accentOptions[0],
  cornerRadius: 28,
  collapsed: false,
  pinned: false,
  favorite: false,
};

const emptyTextForm: BoardTextFormState = {
  id: "",
  content: "",
  fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
  fontSize: DEFAULT_TEXT_STYLE.fontSize,
  textColor: DEFAULT_TEXT_STYLE.textColor,
  tone: DEFAULT_TEXT_STYLE.tone,
  cornerRadius: 26,
};

export default function LinksPage() {
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(LINKS_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [textForm, setTextForm] = useState(emptyTextForm);

  const links = useMemo(
    () => filterActive(collections.links).filter((item) => !item.archivedAt),
    [collections.links]
  );
  const groups = useMemo(
    () => filterActive(collections.linkGroups).filter((item) => !item.archivedAt),
    [collections.linkGroups]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter((item) => item.space === LINKS_SPACE),
    [collections.boardTexts]
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const selectedGroupLinks = useMemo(
    () =>
      selectedGroup
        ? links.filter((link) => link.groupId === selectedGroup.id)
        : [],
    [links, selectedGroup]
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
            width: GROUP_DEFAULT_SIZE.width,
            height: GROUP_DEFAULT_SIZE.height,
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
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
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
            width: GROUP_DEFAULT_SIZE.width,
            height: GROUP_DEFAULT_SIZE.height,
            columns: 2,
            gapX: 48,
            gapY: 48,
          })
        : null;

      const fallbackPlacement = parentGroup && parentPlacement
        ? createContainerPlacement(
            parentPlacement,
            siblingIndex,
            LINK_TILE_SIZE,
            LINK_GROUP_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: LINK_TILE_SIZE.width,
            height: LINK_TILE_SIZE.height,
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

    const textNodes: Array<SpaceCanvasNode<LinkBoardData>> = boardTexts.map((text, index) => ({
      id: `text-${text.id}`,
      data: {
        kind: "text",
        text,
      },
      placement: getSpacePlacement(
        text,
        LINKS_SPACE,
        createGridPlacement(index, {
          startX: 1040,
          startY: 120,
          width: DEFAULT_TEXT_SIZE.width,
          height: DEFAULT_TEXT_SIZE.height,
          columns: 2,
          gapX: 28,
          gapY: 28,
        })
      ),
      resizable: true,
      minSize: {
        width: 220,
        height: 120,
      },
      zIndex: 24,
    }));

    return [...groupNodes, ...linkNodes, ...textNodes];
  }, [boardTexts, groupPlacements, groups, links]);

  function openCreateLink(groupId?: string | null) {
    setLinkForm({
      ...emptyLinkForm,
      groupId: groupId ?? "",
    });
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
      cornerRadius: link.cornerRadius,
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

  function openCreateText() {
    setTextForm(emptyTextForm);
    setTextModalOpen(true);
  }

  function openEditText(text: BoardTextItem) {
    setTextForm({
      id: text.id,
      content: text.content,
      fontFamily: text.fontFamily,
      fontSize: text.fontSize,
      textColor: text.textColor,
      tone: text.tone,
      cornerRadius: text.cornerRadius,
    });
    setTextModalOpen(true);
  }

  function openEditGroup(group: LinkGroup) {
    setSelectedGroupId(null);
    setGroupForm({
      id: group.id,
      title: group.title,
      description: group.description,
      accent: group.accent,
      cornerRadius: group.cornerRadius,
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
    let nextLink = upsertEntity<LinkItem>(
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
        cornerRadius: linkForm.cornerRadius,
        pinned: linkForm.pinned,
        favorite: linkForm.favorite,
      },
      current?.order ?? nextOrder(collections.links)
    );

    nextLink = ensureShortcutBoardPlacements(nextLink, settings, LINK_TILE_SIZE);
    const targetGroup = nextLink.groupId
      ? groups.find((group) => group.id === nextLink.groupId) ?? null
      : null;

    if (targetGroup && (!current || current.groupId !== nextLink.groupId)) {
      const targetGroupPlacement =
        groupPlacements.get(targetGroup.id) ??
        createGridPlacement(0, {
          startX: 120,
          startY: 120,
          width: GROUP_DEFAULT_SIZE.width,
          height: GROUP_DEFAULT_SIZE.height,
          columns: 2,
          gapX: 48,
          gapY: 48,
        });
      const siblingCount = links.filter(
        (link) => link.groupId === targetGroup.id && link.id !== nextLink.id
      ).length;
      const { container, placement } = createContainerPlacement(
        targetGroupPlacement,
        siblingCount,
        LINK_TILE_SIZE,
        LINK_GROUP_LAYOUT
      );

      nextLink = setSpacePlacement(nextLink, LINKS_SPACE, placement);

      await Promise.all([
        saveItem("links", nextLink),
        container.width !== targetGroupPlacement.width ||
        container.height !== targetGroupPlacement.height
          ? saveItem("linkGroups", setSpacePlacement(targetGroup, LINKS_SPACE, container))
          : Promise.resolve(),
      ]);
    } else {
      if (!nextLink.spacePlacements?.[LINKS_SPACE] && !nextLink.groupId) {
        nextLink = ensureEntityCenteredInSpace(
          nextLink,
          LINKS_SPACE,
          viewport,
          LINK_TILE_SIZE
        );
      }

      await saveItem("links", nextLink);
    }

    setLinkModalOpen(false);
    pushToast({
      title: current ? t("edit") : t("addLink"),
      description: t("linkSaved"),
      tone: "success",
    });
  }

  async function saveGroupCard() {
    const current = collections.linkGroups.find((item) => item.id === groupForm.id);
    let nextGroup = upsertEntity<LinkGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        accent: groupForm.accent,
        cornerRadius: groupForm.cornerRadius,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.linkGroups)
    );

    nextGroup = ensureShortcutBoardPlacements(nextGroup, settings, GROUP_DEFAULT_SIZE);

    if (!nextGroup.spacePlacements?.[LINKS_SPACE]) {
      nextGroup = ensureEntityCenteredInSpace(
        nextGroup,
        LINKS_SPACE,
        viewport,
        GROUP_DEFAULT_SIZE
      );
    }

    await saveItem("linkGroups", nextGroup);
    setGroupModalOpen(false);
    pushToast({
      title: current ? t("edit") : t("createGroup"),
      description: t("listSaved"),
      tone: "success",
    });
  }

  async function saveLinkItem(item: LinkItem) {
    await saveItem("links", ensureShortcutBoardPlacements(item, settings, LINK_TILE_SIZE));
  }

  async function saveGroupItem(item: LinkGroup) {
    await saveItem(
      "linkGroups",
      ensureShortcutBoardPlacements(item, settings, GROUP_DEFAULT_SIZE)
    );
  }

  async function saveTextCard() {
    const current = collections.boardTexts.find((item) => item.id === textForm.id);
    let nextText = upsertEntity<BoardTextItem>(
      current,
      {
        title: "",
        description: "",
        space: LINKS_SPACE,
        content: textForm.content,
        fontFamily: textForm.fontFamily,
        fontSize: textForm.fontSize,
        textColor: textForm.textColor,
        tone: textForm.tone,
        cornerRadius: textForm.cornerRadius,
      },
      current?.order ?? nextOrder(collections.boardTexts)
    );

    if (!nextText.spacePlacements?.[LINKS_SPACE]) {
      nextText = ensureEntityCenteredInSpace(
        nextText,
        LINKS_SPACE,
        viewport,
        DEFAULT_TEXT_SIZE
      );
    }

    await saveItem("boardTexts", nextText);
    setTextModalOpen(false);
  }

  async function deleteGroup(group: LinkGroup) {
    await Promise.all([
      saveMany(
        "links",
        collections.links.map((link) =>
          link.groupId === group.id ? { ...link, groupId: null } : link
        )
      ),
      hardDelete("linkGroups", group.id),
    ]);
    setSelectedGroupId((current) => (current === group.id ? null : current));
  }

  async function handleGroupPlacementCommit(
    group: LinkGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;
    const movedLinks = collections.links
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
    const tasks: Array<Promise<void>> = [
      saveItem("linkGroups", setSpacePlacement(group, LINKS_SPACE, placement)),
    ];

    if (deltaX || deltaY) {
      const untouchedLinks = collections.links.filter((link) => link.groupId !== group.id);
      tasks.push(saveMany("links", [...untouchedLinks, ...movedLinks]));
    }

    await Promise.all(tasks);
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
          <Button className="rounded-full" onClick={openCreateText} variant="secondary">
            {t("createText")}
          </Button>
        </div>
        <div className="pointer-events-auto">
          <Button className="gap-2 rounded-full" onClick={() => openCreateLink()}>
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
              <Button onClick={() => openCreateLink()} variant="secondary">
                {t("addLink")}
              </Button>
            }
            description={t("linksEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "group") {
            setSelectedGroupId(node.data.group.id);
            return;
          }

          if (node.data.kind === "text") {
            openEditText(node.data.text);
            return;
          }

          if (node.data.kind === "link") {
            window.open(normalizeUrl(node.data.link.url), "_blank", "noopener,noreferrer");
          }
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "group") {
            return [];
          }

          const groupNode = node.data as Extract<LinkBoardData, { kind: "group" }>;

          return links
            .filter((link) => link.groupId === groupNode.group.id)
            .map((link) => `link-${link.id}`);
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

          if (node.data.kind === "text") {
            void saveItem("boardTexts", setSpacePlacement(node.data.text, LINKS_SPACE, placement));
            return;
          }

          void handleLinkPlacementCommit(node.data.link, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node, options) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <LinkFrameCard
                group={groupNode.group}
                linkCount={groupNode.linkCount}
                placementWidth={node.placement.width}
                isDragging={options.isDragging}
                onEdit={() => openEditGroup(groupNode.group)}
                onDelete={() => void deleteGroup(groupNode.group)}
                onSave={saveGroupItem}
              />
            );
          }

          if (node.data.kind === "text") {
            const textNode = node.data;

            return (
              <BoardTextCard
                className="cursor-grab active:cursor-grabbing"
                item={textNode.text}
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
                      <DropdownMenuItem onClick={() => openEditText(textNode.text)}>
                        {t("editText")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void hardDelete("boardTexts", textNode.text.id)}
                      >
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            );
          }

          const linkNode = node.data as Extract<LinkBoardData, { kind: "link" }>;

          return (
            <LinkTileCard
              link={linkNode.link}
              onDelete={() => void hardDelete("links", linkNode.link.id)}
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
          <Field hint={`${linkForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={40}
              min={10}
              onChange={(event) =>
                setLinkForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={linkForm.cornerRadius}
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
          <Field hint={`${groupForm.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={48}
              min={10}
              onChange={(event) =>
                setGroupForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={groupForm.cornerRadius}
            />
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

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            {selectedGroup ? (
              <Button
                className="gap-2"
                onClick={() => openCreateLink(selectedGroup.id)}
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                {t("addLink")}
              </Button>
            ) : null}
            <Button onClick={() => setSelectedGroupId(null)}>{t("cancel")}</Button>
          </div>
        }
        onClose={() => setSelectedGroupId(null)}
        open={!!selectedGroup}
        size="lg"
        title={selectedGroup?.title || t("createGroup")}
      >
        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              {selectedGroup.description ? (
                <p className="text-sm leading-6 text-[var(--app-muted)]">
                  {selectedGroup.description}
                </p>
              ) : <div />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditGroup(selectedGroup)}>
                    {t("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void saveGroupItem(togglePinned(selectedGroup))}
                  >
                    {selectedGroup.pinned ? t("unpin") : t("pin")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => void saveGroupItem(toggleFavorite(selectedGroup))}
                  >
                    {selectedGroup.favorite ? t("removeFavorite") : t("favorite")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void deleteGroup(selectedGroup)}>
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {selectedGroupLinks.length ? (
              <div className="space-y-3">
                {selectedGroupLinks.map((link) => (
                  <button
                    className="flex w-full items-center justify-between rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                    key={link.id}
                    onClick={() =>
                      window.open(normalizeUrl(link.url), "_blank", "noopener,noreferrer")
                    }
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        alt={link.title}
                        className="h-10 w-10 rounded-full object-cover"
                        draggable={false}
                        src={link.customIconUrl || link.iconUrl || getFaviconUrl(link.url)}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--app-text)]">{link.title}</p>
                        <p className="truncate text-sm text-[var(--app-muted)]">
                          {link.statusText || link.description || link.url}
                        </p>
                      </div>
                    </div>
                    <Badge>{t("open")}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState description={t("noGroup")} title="" />
            )}
          </div>
        ) : null}
      </Modal>

      <BoardTextEditorModal
        form={textForm}
        onChange={setTextForm}
        onClose={() => setTextModalOpen(false)}
        onSave={() => void saveTextCard()}
        open={textModalOpen}
        title={textForm.id ? t("editText") : t("createText")}
      />
    </div>
  );
}

function LinkTileCard({
  link,
  onEdit,
  onSave,
  onDelete,
}: {
  link: LinkItem;
  onEdit: () => void;
  onSave: (item: LinkItem) => Promise<void>;
  onDelete: () => void;
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
      cornerRadius={link.cornerRadius}
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
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
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
  placementWidth,
  isDragging,
  onEdit,
  onSave,
  onDelete,
}: {
  group: LinkGroup;
  linkCount: number;
  placementWidth: number;
  isDragging: boolean;
  onEdit: () => void;
  onSave: (item: LinkGroup) => Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <CanvasFrame
      accent={group.accent}
      cornerRadius={group.cornerRadius}
      count={linkCount}
      isDragging={isDragging}
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
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      placementWidth={placementWidth}
      subtitle={group.description || t("links")}
      title={group.title}
    />
  );
}
