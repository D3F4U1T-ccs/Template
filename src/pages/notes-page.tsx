import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";

import { accentOptions } from "@/data/app-config";
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
import type { NoteDocument, NoteGroup, WorkspaceSpaceKey } from "@/types/models";
import {
  filterActive,
  getSpacePlacement,
  markDeleted,
  markViewed,
  nextOrder,
  setSpacePlacement,
  toggleArchive,
  toggleFavorite,
  togglePinned,
  upsertEntity,
} from "@/utils/entity";
import { createGridPlacement, getPlacementOverlapRatio } from "@/utils/space";
import { formatDateTime } from "@/utils/date";

const NOTES_SPACE: WorkspaceSpaceKey = "notes-board";
const GROUP_MIN_WIDTH = 420;
const GROUP_MIN_HEIGHT = 280;

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
    };

const emptyNoteForm = {
  id: "",
  title: "",
  description: "",
  content: "",
  tags: "",
  groupId: "",
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

export default function NotesPage() {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const { collections, saveItem, saveMany } = useAppData();
  const { viewport, setViewport } = useSpaceViewport(NOTES_SPACE);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const viewedNoteIdRef = useRef<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [form, setForm] = useState(emptyNoteForm);

  const groups = useMemo(
    () => filterActive(collections.noteGroups).filter((item) => !item.archivedAt),
    [collections.noteGroups]
  );
  const notes = useMemo(
    () => filterActive(collections.notes).filter((item) => !item.archivedAt),
    [collections.notes]
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

    return [...groupNodes, ...noteNodes];
  }, [groupPlacements, groups, notes]);

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

  function openCreateNote() {
    setCreateOpen(true);
    navigate("/notes");
  }

  function openCreateGroup() {
    setGroupForm({
      ...emptyGroupForm,
      accent: accentOptions[Math.floor(Math.random() * accentOptions.length)],
    });
    setGroupModalOpen(true);
  }

  function openEditGroup(group: NoteGroup) {
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

  function closeModal() {
    setCreateOpen(false);
    navigate("/notes");
  }

  async function saveNote() {
    const current = notes.find((item) => item.id === form.id);
    const nextNote = upsertEntity<NoteDocument>(
      current,
      {
        title: form.title.trim() || t("untitledNote"),
        description: form.description,
        content: form.content,
        groupId: form.groupId || null,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        pinned: form.pinned,
        favorite: form.favorite,
      },
      current?.order ?? nextOrder(collections.notes)
    );

    await saveItem("notes", nextNote);
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
    const nextGroup = upsertEntity<NoteGroup>(
      current,
      {
        title: groupForm.title.trim() || t("untitledGroup"),
        description: groupForm.description,
        accent: groupForm.accent,
        collapsed: groupForm.collapsed,
        pinned: groupForm.pinned,
        favorite: groupForm.favorite,
      },
      current?.order ?? nextOrder(collections.noteGroups)
    );

    await saveItem("noteGroups", nextGroup);
    setGroupModalOpen(false);
  }

  async function deleteNote(note: NoteDocument) {
    await saveItem("notes", markDeleted(note));

    if (note.id === selectedNote?.id) {
      closeModal();
    }
  }

  async function handleGroupPlacementCommit(
    group: NoteGroup,
    placement: ReturnType<typeof createGridPlacement>
  ) {
    const previousPlacement = groupPlacements.get(group.id);

    if (!previousPlacement) {
      return;
    }

    await saveItem("noteGroups", setSpacePlacement(group, NOTES_SPACE, placement));

    const deltaX = placement.x - previousPlacement.x;
    const deltaY = placement.y - previousPlacement.y;

    if (!deltaX && !deltaY) {
      return;
    }

    const movedNotes = notes
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

    if (!movedNotes.length) {
      return;
    }

    const untouchedNotes = collections.notes.filter((note) => note.groupId !== group.id);
    await saveMany("notes", [...untouchedNotes, ...movedNotes]);
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
          <Button className="gap-2 rounded-full" onClick={openCreateNote}>
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
              <Button onClick={openCreateNote} variant="secondary">
                {t("createNote")}
              </Button>
            }
            description={t("notesEmpty")}
            title=""
          />
        }
        nodes={nodes}
        onNodeClick={(node) => {
          if (node.data.kind === "note") {
            navigate(`/notes/${node.data.note.id}`);
          }
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

          void handleNotePlacementCommit(node.data.note, placement);
        }}
        onViewportChange={setViewport}
        renderNode={(node) => {
          if (node.data.kind === "group") {
            const groupNode = node.data;

            return (
              <NoteFrameCard
                group={groupNode.group}
                noteCount={groupNode.noteCount}
                onEdit={() => openEditGroup(groupNode.group)}
                onSave={(item) => void saveItem("noteGroups", item)}
              />
            );
          }

          const noteNode = node.data;

          return (
            <NoteTileCard
              note={noteNode.note}
              onDelete={() => void deleteNote(noteNode.note)}
              onOpen={() => navigate(`/notes/${noteNode.note.id}`)}
              onSave={(item) => void saveItem("notes", item)}
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
            <DropdownMenuItem onClick={() => onSave(toggleArchive(note))}>
              {note.archivedAt ? t("restore") : t("archive")}
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
  onEdit,
  onSave,
}: {
  group: NoteGroup;
  noteCount: number;
  onEdit: () => void;
  onSave: (item: NoteGroup) => void;
}) {
  const { t } = useI18n();

  return (
    <FrameSurface accent={group.accent}>
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
            <DropdownMenuItem onClick={() => onSave(togglePinned(group))}>
              {group.pinned ? t("unpin") : t("pin")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleFavorite(group))}>
              {group.favorite ? t("removeFavorite") : t("favorite")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(toggleArchive(group))}>
              {group.archivedAt ? t("restore") : t("archive")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSave(markDeleted(group))}>
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mt-5 flex-1 rounded-[24px] border border-white/10 bg-black/72" />

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-white/52">{t("listFrameHint")}</span>
        <Badge className="border-white/10 bg-white/5 text-white/70">{noteCount}</Badge>
      </div>
    </FrameSurface>
  );
}

function FrameSurface({
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
