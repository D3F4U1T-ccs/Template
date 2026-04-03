import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
import { BoardTextCard } from "@/components/ui/board-text-card";
import {
  BoardTextEditorModal,
  type BoardTextFormState,
} from "@/components/ui/board-text-editor-modal";
import { CanvasFrame } from "@/components/ui/canvas-frame";
import { Modal } from "@/components/ui/modal";
import { ObjectTileCard } from "@/components/ui/object-tile-card";
import { EmptyState, Field, Input, Select, Textarea, Badge } from "@/components/ui/primitives";
import { SpaceCanvas, type SpaceCanvasNode } from "@/components/ui/space-canvas";
import { useI18n } from "@/data/i18n";
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
  NoteDocument,
  NoteGroup,
  WorkspaceSpaceKey,
} from "@/types/models";
import {
  filterActive,
  getSpacePlacement,
  markViewed,
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
import { formatDateTime } from "@/utils/date";

const NOTES_SPACE: WorkspaceSpaceKey = "notes-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;
const NOTE_TILE_SIZE = {
  width: 208,
  height: 208,
};
const GROUP_DEFAULT_SIZE = {
  width: 760,
  height: 380,
};

type NoteBoardData =
  | {
      kind: "group";
      group: NoteGroup;
      noteCount: number;
    }
  | {
      kind: "note";
      note: NoteDocument;
      group: NoteGroup | null;
    }
  | {
      kind: "text";
      text: BoardTextItem;
    };

const emptyNoteForm = {
  id: "",
  title: "",
  description: "",
  content: "",
  tags: "",
  groupId: "",
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

export default function NotesPage() {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { collections, hardDelete, saveItem, saveMany, settings } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(NOTES_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const viewedNoteIdRef = useRef<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [form, setForm] = useState(emptyNoteForm);
  const [textForm, setTextForm] = useState(emptyTextForm);

  const groups = useMemo(
    () => filterActive(collections.noteGroups).filter((item) => !item.archivedAt),
    [collections.noteGroups]
  );
  const notes = useMemo(
    () => filterActive(collections.notes).filter((item) => !item.archivedAt),
    [collections.notes]
  );
  const boardTexts = useMemo(
    () =>
      filterActive(collections.boardTexts).filter((item) => item.space === NOTES_SPACE),
    [collections.boardTexts]
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const selectedGroupNotes = useMemo(
    () =>
      selectedGroup
        ? notes.filter((note) => note.groupId === selectedGroup.id)
        : [],
    [notes, selectedGroup]
  );

  const selectedNote = useMemo(
    () => notes.find((item) => item.id === noteId) ?? null,
    [noteId, notes]
  );

  const groupPlacements = useMemo(() => {
    const map = new Map<string, ReturnType<typeof createGridPlacement>>();

    groups.forEach((group, index) => {
      map.set(
        group.id,
        getSpacePlacement(
          group,
          NOTES_SPACE,
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

  const nodes = useMemo<Array<SpaceCanvasNode<NoteBoardData>>>(() => {
    const groupNodes: Array<SpaceCanvasNode<NoteBoardData>> = groups.map((group) => ({
      id: `group-${group.id}`,
      data: {
        kind: "group",
        group,
        noteCount: notes.filter((note) => note.groupId === group.id).length,
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

    const groupedNotes = new Map<string | null, NoteDocument[]>();

    notes.forEach((note) => {
      const bucket = groupedNotes.get(note.groupId) ?? [];
      bucket.push(note);
      groupedNotes.set(note.groupId, bucket);
    });

    const noteNodes: Array<SpaceCanvasNode<NoteBoardData>> = notes.map((note, index) => {
      const parentGroup = note.groupId
        ? groups.find((group) => group.id === note.groupId) ?? null
        : null;
      const siblingIndex = (groupedNotes.get(note.groupId) ?? []).findIndex(
        (entry) => entry.id === note.id
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
            NOTE_TILE_SIZE,
            LINK_GROUP_LAYOUT
          ).placement
        : createGridPlacement(index, {
            startX: 1840,
            startY: 140,
            width: NOTE_TILE_SIZE.width,
            height: NOTE_TILE_SIZE.height,
            columns: 5,
            gapX: 28,
            gapY: 28,
          });

      return {
        id: `note-${note.id}`,
        data: {
          kind: "note",
          note,
          group: parentGroup,
        },
        placement: getSpacePlacement(note, NOTES_SPACE, fallbackPlacement),
        zIndex: 18,
      };
    });

    const textNodes: Array<SpaceCanvasNode<NoteBoardData>> = boardTexts.map((text, index) => ({
      id: `text-${text.id}`,
      data: {
        kind: "text",
        text,
      },
      placement: getSpacePlacement(
        text,
        NOTES_SPACE,
        createGridPlacement(index, {
          startX: 1080,
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

    return [...groupNodes, ...noteNodes, ...textNodes];
  }, [boardTexts, groupPlacements, groups, notes]);

  const modalOpen = createOpen || !!selectedNote;

  useEffect(() => {
    if (createOpen) {
      setForm(emptyNoteForm);
      return;
    }

    if (!selectedNote) {
      setForm(emptyNoteForm);
      return;
    }

    setForm({
      id: selectedNote.id,
      title: selectedNote.title,
      description: selectedNote.description,
      content: selectedNote.content,
      tags: selectedNote.tags.join(", "),
      groupId: selectedNote.groupId ?? "",
      cornerRadius: selectedNote.cornerRadius,
      pinned: selectedNote.pinned,
      favorite: selectedNote.favorite,
    });
  }, [createOpen, selectedNote]);

  useEffect(() => {
    if (!selectedNote) {
      viewedNoteIdRef.current = null;
      return;
    }

    if (viewedNoteIdRef.current === selectedNote.id) {
      return;
    }

    viewedNoteIdRef.current = selectedNote.id;
    void saveItem("notes", markViewed(selectedNote));
  }, [saveItem, selectedNote]);

  function openCreateNote(groupId?: string | null) {
    setCreateOpen(true);
    setForm({
      ...emptyNoteForm,
      groupId: groupId ?? "",
    });
    navigate("/notes");
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

  function openEditGroup(group: NoteGroup) {
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

  function closeModal() {
    setCreateOpen(false);
    navigate("/notes");
  }

  async function saveNote() {
    const current = notes.find((item) => item.id === form.id);
    let nextNote = upsertEntity<NoteDocument>(
      current,
      {
        title: form.title.trim() || t("untitledNote"),
        description: form.description,
        content: form.content,
        groupId: form.groupId || null,
        cornerRadius: form.cornerRadius,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        pinned: form.pinned,
        favorite: form.favorite,
      },
      current?.order ?? nextOrder(collections.notes)
    );

    nextNote = ensureShortcutBoardPlacements(nextNote, settings, NOTE_TILE_SIZE);
    const targetGroup = nextNote.groupId
      ? groups.find((group) => group.id === nextNote.groupId) ?? null
      : null;

    if (targetGroup && (!current || current.groupId !== nextNote.groupId)) {
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
      const siblingCount = notes.filter(
        (entry) => entry.groupId === targetGroup.id && entry.id !== nextNote.id
      ).length;
      const { container, placement } = createContainerPlacement(
        targetGroupPlacement,
        siblingCount,
        NOTE_TILE_SIZE,
        LINK_GROUP_LAYOUT
      );

      nextNote = setSpacePlacement(nextNote, NOTES_SPACE, placement);

      await Promise.all([
        saveItem("notes", nextNote),
        container.width !== targetGroupPlacement.width ||
        container.height !== targetGroupPlacement.height
          ? saveItem("noteGroups", setSpacePlacement(targetGroup, NOTES_SPACE, container))
          : Promise.resolve(),
      ]);
    } else {
      if (!nextNote.spacePlacements?.[NOTES_SPACE] && !nextNote.groupId) {
        nextNote = ensureEntityCenteredInSpace(
          nextNote,
          NOTES_SPACE,
          viewport,
          NOTE_TILE_SIZE
        );
      }

      await saveItem("notes", nextNote);
    }

    pushToast({
      title: current ? t("edit") : t("createNote"),
      description: t("noteSaved"),
      tone: "success",
    });
    setCreateOpen(false);
    navigate("/notes");
  }

  async function saveGroup() {
    const current = collections.noteGroups.find((item) => item.id === groupForm.id);
    let nextGroup = upsertEntity<NoteGroup>(
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
      current?.order ?? nextOrder(collections.noteGroups)
    );

    nextGroup = ensureShortcutBoardPlacements(nextGroup, settings, GROUP_DEFAULT_SIZE);

    if (!nextGroup.spacePlacements?.[NOTES_SPACE]) {
      nextGroup = ensureEntityCenteredInSpace(
        nextGroup,
        NOTES_SPACE,
        viewport,
        GROUP_DEFAULT_SIZE
      );
    }

    await saveItem("noteGroups", nextGroup);
    setGroupModalOpen(false);
  }

  async function deleteNote(note: NoteDocument) {
    await hardDelete("notes", note.id);

    if (note.id === selectedNote?.id) {
      closeModal();
    }
  }

  async function saveTextCard() {
    const current = collections.boardTexts.find((item) => item.id === textForm.id);
    let nextText = upsertEntity<BoardTextItem>(
      current,
      {
        title: "",
        description: "",
        space: NOTES_SPACE,
        content: textForm.content,
        fontFamily: textForm.fontFamily,
        fontSize: textForm.fontSize,
        textColor: textForm.textColor,
        tone: textForm.tone,
        cornerRadius: textForm.cornerRadius,
      },
      current?.order ?? nextOrder(collections.boardTexts)
    );

    if (!nextText.spacePlacements?.[NOTES_SPACE]) {
      nextText = ensureEntityCenteredInSpace(
        nextText,
        NOTES_SPACE,
        viewport,
        DEFAULT_TEXT_SIZE
      );
    }

    await saveItem("boardTexts", nextText);
    setTextModalOpen(false);
  }

  async function deleteGroup(group: NoteGroup) {
    await Promise.all([
      saveMany(
        "notes",
        collections.notes.map((note) =>
          note.groupId === group.id ? { ...note, groupId: null } : note
        )
      ),
      hardDelete("noteGroups", group.id),
    ]);
    setSelectedGroupId((current) => (current === group.id ? null : current));
  }

  async function handleGroupPlacementCommit(
    group: NoteGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;
    const movedNotes = collections.notes
      .filter((note) => note.groupId === group.id)
      .map((note) => {
        const notePlacement = getSpacePlacement(
          note,
          NOTES_SPACE,
          createGridPlacement(0, {
            startX: placement.x + 28,
            startY: placement.y + 84,
            width: 208,
            height: 208,
          })
        );

        return setSpacePlacement(note, NOTES_SPACE, {
          ...notePlacement,
          x: notePlacement.x + deltaX,
          y: notePlacement.y + deltaY,
        });
      });
    const queue: Array<Promise<void>> = [
      saveItem("noteGroups", setSpacePlacement(group, NOTES_SPACE, placement)),
    ];

    if (deltaX || deltaY) {
      const untouchedNotes = collections.notes.filter((note) => note.groupId !== group.id);
      queue.push(saveMany("notes", [...untouchedNotes, ...movedNotes]));
    }

    await Promise.all(queue);
  }

  async function handleNotePlacementCommit(
    note: NoteDocument,
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
      "notes",
      setSpacePlacement(
        {
          ...note,
          groupId: targetGroup?.group.id ?? null,
        },
        NOTES_SPACE,
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
          <Button className="gap-2 rounded-full" onClick={() => openCreateNote()}>
            <Plus className="h-4 w-4" />
            {t("createNote")}
          </Button>
        </div>
      </div>

      <SpaceCanvas
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        emptyState={
          <EmptyState
            action={
              <Button onClick={() => openCreateNote()} variant="secondary">
                {t("createNote")}
              </Button>
            }
            description={t("notesEmpty")}
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

          if (node.data.kind === "note") {
            navigate(`/notes/${node.data.note.id}`);
          }
        }}
        getLinkedNodeIds={(node) => {
          if (node.data.kind !== "group") {
            return [];
          }

          const groupNode = node.data as Extract<NoteBoardData, { kind: "group" }>;

          return notes
            .filter((note) => note.groupId === groupNode.group.id)
            .map((note) => `note-${note.id}`);
        }}
        onPlacementCommit={(id, placement) => {
          const node = nodes.find((item) => item.id === id);

          if (!node) {
            return;
          }

          if (node.data.kind === "group") {
            void handleGroupPlacementCommit(node.data.group, placement);
            return;
          }

          if (node.data.kind === "text") {
            void saveItem("boardTexts", setSpacePlacement(node.data.text, NOTES_SPACE, placement));
            return;
          }

          void handleNotePlacementCommit(node.data.note, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node, options) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <NoteFrameCard
                group={groupNode.group}
                isDragging={options.isDragging}
                noteCount={groupNode.noteCount}
                placementWidth={node.placement.width}
                onEdit={() => openEditGroup(groupNode.group)}
                onDelete={() => void deleteGroup(groupNode.group)}
                onSave={(item) =>
                  void saveItem(
                    "noteGroups",
                    ensureShortcutBoardPlacements(item, settings, GROUP_DEFAULT_SIZE)
                  )
                }
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

          const noteNode = node.data;

          return (
            <NoteTileCard
              note={noteNode.note}
              onDelete={() => void deleteNote(noteNode.note)}
              onOpen={() => navigate(`/notes/${noteNode.note.id}`)}
              onSave={(item) =>
                void saveItem(
                  "notes",
                  ensureShortcutBoardPlacements(item, settings, NOTE_TILE_SIZE)
                )
              }
            />
          );
        }}
        size={{ width: 4600, height: 2800 }}
        viewport={viewport}
      />

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={closeModal} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveNote()}>{t("save")}</Button>
          </div>
        }
        onClose={closeModal}
        open={modalOpen}
        size="xl"
        title={selectedNote?.title || t("createNote")}
      >
        <div className="grid gap-4">
          <Field label={t("fieldGroup")}>
            <Select
              onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))}
              value={form.groupId}
            >
              <option value="">{t("noGroup")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t("placeholderItemTitle")}
              value={form.title}
            />
          </Field>
          <Field hint={`${form.cornerRadius}px`} label={t("fieldRoundness")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={40}
              min={10}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  cornerRadius: Number(event.target.value),
                }))
              }
              step={1}
              type="range"
              value={form.cornerRadius}
            />
          </Field>
          <Field label={t("fieldDescription")}>
            <Input
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={t("placeholderItemDescription")}
              value={form.description}
            />
          </Field>
          <Field label={t("fieldText")}>
            <Textarea
              className="min-h-[52vh] resize-none"
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              placeholder={t("fieldText")}
              value={form.content}
            />
          </Field>
          <Field label={t("fieldTags")}>
            <Input
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="work, idea, draft"
              value={form.tags}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setGroupModalOpen(false)} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={() => void saveGroup()}>{t("save")}</Button>
          </div>
        }
        onClose={() => setGroupModalOpen(false)}
        open={groupModalOpen}
        title={groupForm.id ? t("edit") : t("createGroup")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fieldTitle")}>
            <Input
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder={t("placeholderListTitle")}
              value={groupForm.title}
            />
          </Field>
          <Field label={t("fieldAccent")}>
            <Select
              onChange={(event) =>
                setGroupForm((current) => ({ ...current, accent: event.target.value }))
              }
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
                onClick={() => openCreateNote(selectedGroup.id)}
                variant="secondary"
              >
                <Plus className="h-4 w-4" />
                {t("createNote")}
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
                    onClick={() =>
                      void saveItem(
                        "noteGroups",
                        ensureShortcutBoardPlacements(
                          togglePinned(selectedGroup),
                          settings,
                          GROUP_DEFAULT_SIZE
                        )
                      )
                    }
                  >
                    {selectedGroup.pinned ? t("unpin") : t("pin")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      void saveItem(
                        "noteGroups",
                        ensureShortcutBoardPlacements(
                          toggleFavorite(selectedGroup),
                          settings,
                          GROUP_DEFAULT_SIZE
                        )
                      )
                    }
                  >
                    {selectedGroup.favorite ? t("removeFavorite") : t("favorite")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void deleteGroup(selectedGroup)}>
                    {t("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {selectedGroupNotes.length ? (
              <div className="space-y-3">
                {selectedGroupNotes.map((note) => (
                  <button
                    className="flex w-full items-start justify-between rounded-[22px] border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-4 text-left transition hover:bg-[var(--card-hover)]"
                    key={note.id}
                    onClick={() => navigate(`/notes/${note.id}`)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--app-text)]">{note.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--app-muted)]">
                        {note.description || formatDateTime(note.updatedAt)}
                      </p>
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

function NoteTileCard({
  note,
  onOpen,
  onSave,
  onDelete,
}: {
  note: NoteDocument;
  onOpen: () => void;
  onSave: (item: NoteDocument) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const subtitle = note.description || formatDateTime(note.updatedAt);

  return (
    <ObjectTileCard
      avatarLabel={note.title.slice(0, 1).toUpperCase() || "N"}
      className="cursor-grab active:cursor-grabbing"
      cornerRadius={note.cornerRadius}
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
            <DropdownMenuItem onClick={onOpen}>{t("open")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(togglePinned(note))}>
              {note.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(note))}>
              {note.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      subtitle={subtitle}
      title={note.title}
    />
  );
}

function NoteFrameCard({
  group,
  noteCount,
  placementWidth,
  isDragging,
  onEdit,
  onSave,
  onDelete,
}: {
  group: NoteGroup;
  noteCount: number;
  placementWidth: number;
  isDragging: boolean;
  onEdit: () => void;
  onSave: (item: NoteGroup) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <CanvasFrame
      accent={group.accent}
      cornerRadius={group.cornerRadius}
      count={noteCount}
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
            <DropdownMenuItem onClick={() => onSave(togglePinned(group))}>
              {group.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(group))}>
              {group.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete}>{t("delete")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      placementWidth={placementWidth}
      subtitle={group.description || t("notes")}
      title={group.title}
    />
  );
}
