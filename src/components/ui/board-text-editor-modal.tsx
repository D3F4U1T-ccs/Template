import { boardTextFontOptions } from "@/data/app-config";
import { useI18n } from "@/data/i18n";
import { Button } from "@/shared/ui/button";
import type { BoardTextTone } from "@/types/models";

import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";

export type BoardTextFormState = {
  id: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  tone: BoardTextTone;
  cornerRadius: number;
};

export function BoardTextEditorModal({
  open,
  title,
  form,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  form: BoardTextFormState;
  onChange: (next: BoardTextFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="ghost">
            {t("cancel")}
          </Button>
          <Button onClick={onSave}>{t("save")}</Button>
        </div>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title={title}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label={t("fieldText")}>
            <Textarea
              className="min-h-[240px]"
              onChange={(event) => onChange({ ...form, content: event.target.value })}
              placeholder={t("placeholderTextBlock")}
              value={form.content}
            />
          </Field>
        </div>
        <Field label={t("fieldFont")}>
          <Select
            onChange={(event) => onChange({ ...form, fontFamily: event.target.value })}
            value={form.fontFamily}
          >
            {boardTextFontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field hint={`${form.fontSize}px`} label={t("fieldFontSize")}>
          <input
            className="w-full accent-[var(--app-brand)]"
            max={72}
            min={14}
            onChange={(event) =>
              onChange({ ...form, fontSize: Number(event.target.value) })
            }
            step={1}
            type="range"
            value={form.fontSize}
          />
        </Field>
        <Field label={t("fieldTextColor")}>
          <Input
            onChange={(event) => onChange({ ...form, textColor: event.target.value })}
            placeholder="#f8fafc"
            value={form.textColor}
          />
        </Field>
        <Field label={t("fieldType")}>
          <Select
            onChange={(event) =>
              onChange({ ...form, tone: event.target.value as BoardTextTone })
            }
            value={form.tone}
          >
            <option value="plain">{t("textTonePlain")}</option>
            <option value="solid">{t("textToneSolid")}</option>
            <option value="glass">{t("textToneGlass")}</option>
          </Select>
        </Field>
        <Field hint={`${form.cornerRadius}px`} label={t("fieldRoundness")}>
          <input
            className="w-full accent-[var(--app-brand)]"
            max={40}
            min={0}
            onChange={(event) =>
              onChange({ ...form, cornerRadius: Number(event.target.value) })
            }
            step={1}
            type="range"
            value={form.cornerRadius}
          />
        </Field>
      </div>
    </Modal>
  );
}
