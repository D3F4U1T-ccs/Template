import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
};

const sizeClasses = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--app-overlay)] p-4 backdrop-blur-sm">
      <button
        aria-label="Close modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        className={cn(
          "relative z-10 max-h-[88vh] w-full overflow-hidden rounded-[28px] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[var(--shadow-soft)]",
          sizeClasses[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--app-muted)]">{description}</p>
            ) : null}
          </div>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(88vh-160px)] overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-[var(--app-border)] px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
