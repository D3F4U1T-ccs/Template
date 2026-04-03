import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { boardTextFontOptions } from "@/data/app-config";
import { useI18n } from "@/data/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { BoardTextItem } from "@/types/models";

import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/primitives";

function getToneClasses(tone: BoardTextItem["tone"]) {
  switch (tone) {
    case "plain":
      return "";
    case "solid":
      return "rounded-[24px] border border-black/10 px-4 py-3 shadow-[var(--shadow-soft)]";
    case "glass":
      return "rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl";
  }
}

export function BoardTextCard({
  item,
  className,
  active = false,
  previewFontSize,
  onActivate,
  onDeactivate,
  onSave,
  onTogglePin,
  onToggleFavorite,
  onArchive,
  onDelete,
}: {
  item: BoardTextItem;
  className?: string;
  active?: boolean;
  previewFontSize?: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onSave: (patch: Partial<BoardTextItem>) => void;
  onTogglePin?: () => void;
  onToggleFavorite?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(item.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    content: item.content,
    fontFamily: item.fontFamily,
    textColor: item.textColor,
    backgroundColor: item.backgroundColor,
    tone: item.tone,
  }));
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const effectiveFontSize = previewFontSize ?? item.fontSize;
  const isPlain = item.tone === "plain";
  const containerStyle =
    item.tone === "solid"
      ? {
          backgroundColor: item.backgroundColor,
          borderRadius: item.cornerRadius,
        }
      : item.tone === "glass"
        ? {
            borderRadius: item.cornerRadius,
          }
        : undefined;

  useEffect(() => {
    setDraft(item.content);
    setSettingsDraft({
      content: item.content,
      fontFamily: item.fontFamily,
      textColor: item.textColor,
      backgroundColor: item.backgroundColor,
      tone: item.tone,
    });
  }, [
    item.backgroundColor,
    item.content,
    item.fontFamily,
    item.id,
    item.textColor,
    item.tone,
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const length = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(length, length);
    });

    return () => cancelAnimationFrame(frame);
  }, [active]);

  function closeSettings() {
    setSettingsDraft({
      content: item.content,
      fontFamily: item.fontFamily,
      textColor: item.textColor,
      backgroundColor: item.backgroundColor,
      tone: item.tone,
    });
    setSettingsOpen(false);
  }

  function commitInline() {
    if (draft !== item.content) {
      onSave({ content: draft });
    }

    onDeactivate?.();
  }

  function saveSettings() {
    onSave({
      content: settingsDraft.content,
      fontFamily: settingsDraft.fontFamily,
      textColor: settingsDraft.textColor,
      backgroundColor: settingsDraft.backgroundColor,
      tone: settingsDraft.tone,
    });
    setSettingsOpen(false);
  }

  return (
    <>
      <div className={cn("relative h-full w-full overflow-visible", className)}>
        <div className="group relative inline-flex max-w-full overflow-visible">
          <div
            className={cn(
              "relative max-w-full whitespace-pre-wrap break-words text-left leading-[1.15] transition",
              !isPlain && getToneClasses(item.tone)
            )}
            onDoubleClick={() => onActivate?.()}
            style={containerStyle}
          >
            {!active ? (
              <div
                style={{
                  color: item.textColor,
                  fontFamily: item.fontFamily,
                  fontSize: `${effectiveFontSize}px`,
                }}
              >
                {item.content || (
                  <span className="text-white/35">{t("placeholderTextBlock")}</span>
                )}
              </div>
            ) : (
              <textarea
                className={cn(
                  "min-h-[1.2em] w-full max-w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none",
                  !isPlain && "min-w-[240px]"
                )}
                data-space-no-drag="true"
                onBlur={commitInline}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    commitInline();
                    textareaRef.current?.blur();
                  }
                }}
                placeholder={t("placeholderTextBlock")}
                ref={textareaRef}
                rows={Math.max(draft.split("\n").length, 1)}
                style={{
                  color: item.textColor,
                  fontFamily: item.fontFamily,
                  fontSize: `${effectiveFontSize}px`,
                  lineHeight: 1.15,
                }}
                value={draft}
              />
            )}

            <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  className={cn(
                    "absolute -right-8 -top-2 h-8 w-8 rounded-full transition",
                    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  data-space-no-drag="true"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  size="icon"
                  type="button"
                  variant="secondary"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setSettingsOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  {t("editText")}
                </DropdownMenuItem>
                {onTogglePin ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onTogglePin();
                      setMenuOpen(false);
                    }}
                  >
                    {item.pinned ? t("unpin") : t("pin")}
                  </DropdownMenuItem>
                ) : null}
                {onToggleFavorite ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onToggleFavorite();
                      setMenuOpen(false);
                    }}
                  >
                    {item.favorite ? t("removeFavorite") : t("favorite")}
                  </DropdownMenuItem>
                ) : null}
                {onArchive || onDelete ? <DropdownMenuSeparator /> : null}
                {onArchive ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onArchive();
                      setMenuOpen(false);
                    }}
                  >
                    {t("archive")}
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                  >
                    {t("delete")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={closeSettings} variant="ghost">
              {t("cancel")}
            </Button>
            <Button onClick={saveSettings}>{t("save")}</Button>
          </div>
        }
        onClose={closeSettings}
        open={settingsOpen}
        title={t("editText")}
      >
        <div className="grid gap-4">
          <Field label={t("fieldText")}>
            <Textarea
              className="min-h-[220px]"
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
              placeholder={t("placeholderTextBlock")}
              value={settingsDraft.content}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("fieldFont")}>
              <Select
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    fontFamily: event.target.value,
                  }))
                }
                value={settingsDraft.fontFamily}
              >
                {boardTextFontOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("fieldType")}>
              <Select
                onChange={(event) =>
                  setSettingsDraft((current) => ({
                    ...current,
                    tone: event.target.value as BoardTextItem["tone"],
                  }))
                }
                value={settingsDraft.tone}
              >
                <option value="plain">{t("textTonePlain")}</option>
                <option value="solid">{t("textToneSolid")}</option>
                <option value="glass">{t("textToneGlass")}</option>
              </Select>
            </Field>
            <Field label={t("fieldTextColor")}>
              <div className="flex items-center gap-3">
                <input
                  className="h-11 w-14 cursor-pointer rounded-2xl border border-[var(--app-border)] bg-transparent p-1"
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      textColor: event.target.value,
                    }))
                  }
                  type="color"
                  value={settingsDraft.textColor}
                />
                <span className="text-sm text-[var(--app-muted)]">{settingsDraft.textColor}</span>
              </div>
            </Field>
            {settingsDraft.tone === "solid" ? (
              <Field label={t("fieldBackgroundColor")}>
                <div className="flex items-center gap-3">
                  <input
                    className="h-11 w-14 cursor-pointer rounded-2xl border border-[var(--app-border)] bg-transparent p-1"
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        backgroundColor: event.target.value,
                      }))
                    }
                    type="color"
                    value={settingsDraft.backgroundColor}
                  />
                  <span className="text-sm text-[var(--app-muted)]">
                    {settingsDraft.backgroundColor}
                  </span>
                </div>
              </Field>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  );
}
