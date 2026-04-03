import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/data/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { BoardTextItem, BoardTextTone } from "@/types/models";

import { Modal } from "@/components/ui/modal";

function getTextToneClasses(tone: BoardTextTone) {
  switch (tone) {
    case "plain":
      return "border-transparent bg-transparent shadow-none backdrop-blur-0";
    case "solid":
      return "border-[var(--app-border)] bg-[var(--app-panel)]/96 shadow-[var(--shadow-soft)]";
    case "glass":
      return "border-white/15 bg-white/8 shadow-[var(--shadow-soft)] backdrop-blur-xl";
  }
}

export function BoardTextCard({
  item,
  className,
  active = false,
  previewFontSize,
  onActivate,
  onSave,
}: {
  item: BoardTextItem;
  className?: string;
  active?: boolean;
  previewFontSize?: number;
  onActivate?: () => void;
  onSave: (patch: Partial<BoardTextItem>) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(item.content);
  const [styleOpen, setStyleOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const colorInputId = useId();
  const effectiveFontSize = previewFontSize ?? item.fontSize;

  useEffect(() => {
    setDraft(item.content);
  }, [item.content, item.id]);

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

  function commit() {
    if (draft === item.content) {
      return;
    }

    onSave({ content: draft });
  }

  return (
    <>
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-visible rounded-[26px] border p-4 transition",
          getTextToneClasses(item.tone),
          active && "ring-2 ring-[var(--app-brand)]",
          className
        )}
        onDoubleClick={() => onActivate?.()}
        style={{ borderRadius: item.cornerRadius }}
      >
        {active ? (
          <div
            className="absolute -top-12 left-0 z-[80] flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg-elevated)]/95 px-2 py-2 shadow-[var(--shadow-soft)] backdrop-blur"
            data-space-no-drag="true"
          >
            <label
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--app-border)]"
              htmlFor={colorInputId}
              style={{ backgroundColor: item.textColor }}
              title={t("fieldTextColor")}
            >
              <input
                className="sr-only"
                data-space-no-drag="true"
                id={colorInputId}
                onChange={(event) => onSave({ textColor: event.target.value })}
                type="color"
                value={item.textColor}
              />
            </label>
            <Button
              data-space-no-drag="true"
              onClick={() => setStyleOpen(true)}
              size="sm"
              variant="secondary"
            >
              {t("fieldType")}
            </Button>
          </div>
        ) : null}

        {active ? (
          <textarea
            className="h-full min-h-0 w-full resize-none border-0 bg-transparent p-0 leading-[1.15] outline-none"
            data-space-no-drag="true"
            onBlur={commit}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                commit();
                textareaRef.current?.blur();
              }
            }}
            placeholder={t("placeholderTextBlock")}
            ref={textareaRef}
            style={{
              color: item.textColor,
              fontFamily: item.fontFamily,
              fontSize: `${effectiveFontSize}px`,
            }}
            value={draft}
          />
        ) : (
          <div
            className="min-h-0 flex-1 whitespace-pre-wrap break-words leading-[1.15]"
            style={{
              color: item.textColor,
              fontFamily: item.fontFamily,
              fontSize: `${effectiveFontSize}px`,
            }}
          >
            {item.content || " "}
          </div>
        )}
      </div>

      <Modal
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setStyleOpen(false)}>{t("save")}</Button>
          </div>
        }
        onClose={() => setStyleOpen(false)}
        open={styleOpen}
        title={t("fieldType")}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {([
            ["plain", t("textTonePlain")],
            ["solid", t("textToneSolid")],
            ["glass", t("textToneGlass")],
          ] as const).map(([tone, label]) => (
            <button
              className={cn(
                "rounded-[22px] border px-4 py-6 text-left transition",
                item.tone === tone
                  ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)]"
                  : "border-[var(--app-border)] bg-[var(--app-panel-soft)] hover:bg-[var(--card-hover)]"
              )}
              data-space-no-drag="true"
              key={tone}
              onClick={() => {
                onSave({ tone });
                setStyleOpen(false);
              }}
              type="button"
            >
              <div
                className={cn(
                  "mb-4 h-16 rounded-[18px] border p-3",
                  getTextToneClasses(tone)
                )}
              >
                <div
                  className="truncate"
                  style={{
                    color: item.textColor,
                    fontFamily: item.fontFamily,
                    fontSize: "20px",
                  }}
                >
                  Aa
                </div>
              </div>
              <p className="font-medium text-[var(--app-text)]">{label}</p>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
