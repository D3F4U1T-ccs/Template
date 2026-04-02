import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/shared/lib/utils";
import { createId } from "@/utils/entity";

type ToastTone = "info" | "success" | "error";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
};

export const ToastContext = createContext<ToastContextValue | undefined>(
  undefined
);

const toneClasses: Record<ToastTone, string> = {
  info: "border-[var(--app-border)] bg-[var(--app-bg-elevated)]",
  success: "border-emerald-500/30 bg-emerald-500/10",
  error: "border-rose-500/30 bg-rose-500/10",
};

const toneTitleClasses: Record<ToastTone, string> = {
  info: "text-[var(--app-text)]",
  success: "text-emerald-700 dark:text-emerald-100",
  error: "text-rose-700 dark:text-rose-100",
};

const toneDescriptionClasses: Record<ToastTone, string> = {
  info: "text-[var(--app-muted)]",
  success: "text-emerald-700/80 dark:text-emerald-100/80",
  error: "text-rose-700/80 dark:text-rose-100/80",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const nextToast = {
      ...toast,
      id: createId(),
    };

    setToasts((current) => [...current, nextToast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== nextToast.id));
    }, 3400);
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            className={cn(
              "pointer-events-auto rounded-2xl border px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur",
              toneClasses[toast.tone]
            )}
            key={toast.id}
          >
            <p className={cn("text-sm font-semibold", toneTitleClasses[toast.tone])}>
              {toast.title}
            </p>
            {toast.description ? (
              <p className={cn("mt-1 text-sm", toneDescriptionClasses[toast.tone])}>
                {toast.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
