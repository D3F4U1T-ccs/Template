import { LogOut, Settings2 } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { useLanguage } from "@/app/providers/use-language";
import { useTheme } from "@/app/providers/use-theme";
import { useI18n } from "@/data/i18n";
import { navItems } from "@/data/app-config";
import { Modal } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/primitives";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

export function Topbar({ onSearchOpen }: { onSearchOpen: () => void }) {
  const { signOut } = useAuth();
  const { settings, saveWorkspaceSettings } = useAppData();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="fixed right-3 top-3 z-40 lg:right-4 lg:top-4">
        <div className="ml-auto flex w-fit items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-sidebar)] p-2 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="flex items-center gap-1 rounded-full border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-1 py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const label =
                item.key === "dashboard"
                  ? t("dashboard")
                  : item.key === "favorites"
                    ? t("favoritesPage")
                    : item.key === "archive"
                      ? t("archivePage")
                      : t(item.key);

              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-muted)] transition",
                      isActive
                        ? "bg-[var(--app-brand-soft)] text-[var(--app-text)]"
                        : "hover:bg-[var(--card-hover)] hover:text-[var(--app-text)]"
                    )
                  }
                  key={item.key}
                  title={label}
                  to={item.href}
                >
                  <Icon className="h-4 w-4" />
                </NavLink>
              );
            })}
          </div>
          <Button className="gap-2 rounded-full" onClick={onSearchOpen} variant="secondary">
            {t("search")}
          </Button>
          <Button
            className="rounded-full"
            onClick={() => setSettingsOpen(true)}
            size="icon"
            variant="secondary"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Modal
        footer={
          <div className="flex justify-between gap-3">
            <Button className="gap-2" onClick={() => void signOut()} variant="ghost">
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </Button>
            <Button onClick={() => setSettingsOpen(false)}>{t("save")}</Button>
          </div>
        }
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        title={t("settings")}
      >
        <div className="space-y-4">
          <Field label={t("theme")}>
            <Select
              onChange={(event) => {
                const nextTheme = event.target.value as "dark" | "light" | "system";
                setTheme(nextTheme);
                void saveWorkspaceSettings({ theme: nextTheme });
              }}
              value={theme}
            >
              <option value="system">{t("system")}</option>
              <option value="dark">{t("dark")}</option>
              <option value="light">{t("light")}</option>
            </Select>
          </Field>

          <Field label={t("language")}>
            <Select
              onChange={(event) => {
                const nextLanguage = event.target.value as "ru" | "en";
                setLanguage(nextLanguage);
                void saveWorkspaceSettings({ language: nextLanguage });
              }}
              value={language}
            >
              <option value="ru">{t("russian")}</option>
              <option value="en">{t("english")}</option>
            </Select>
          </Field>

          <Field label={t("canvasPattern")}>
            <Select
              onChange={(event) =>
                void saveWorkspaceSettings({
                  canvasPattern: event.target.value as "dots" | "grid",
                })
              }
              value={settings.canvasPattern}
            >
              <option value="dots">{t("dots")}</option>
              <option value="grid">{t("grid")}</option>
            </Select>
          </Field>

          <Field hint={settings.canvasOpacity.toFixed(2)} label={t("canvasOpacity")}>
            <input
              className="w-full accent-[var(--app-brand)]"
              max={1}
              min={0.15}
              onChange={(event) =>
                void saveWorkspaceSettings({
                  canvasOpacity: Number(event.target.value),
                })
              }
              step={0.05}
              type="range"
              value={settings.canvasOpacity}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
