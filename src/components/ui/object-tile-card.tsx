import { MoreVertical } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

type ObjectTileCardProps = {
  title: string;
  subtitle: string;
  avatarUrl?: string;
  avatarLabel?: string;
  menu?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function ObjectTileCard({
  title,
  subtitle,
  avatarUrl,
  avatarLabel,
  menu,
  footer,
  className,
}: ObjectTileCardProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-[var(--app-border)] bg-[var(--app-panel-strong)] p-4 shadow-[var(--shadow-soft)] transition-transform duration-150",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="truncate text-sm font-semibold text-[var(--app-text)]">{title}</p>
        {menu ? (
          <div data-space-no-drag="true">{menu}</div>
        ) : (
          <Button data-space-no-drag="true" size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-2 text-center">
        {avatarUrl ? (
          <img
            alt={title}
            className="h-24 w-24 rounded-full object-cover shadow-[var(--shadow-soft)]"
            draggable={false}
            src={avatarUrl}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--app-brand-soft)] text-4xl font-semibold text-[var(--app-brand)]">
            {avatarLabel ?? title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-h-0 space-y-1 overflow-hidden">
          <p className="truncate text-[17px] font-medium text-[var(--app-text)]">{title}</p>
          <p className="line-clamp-2 break-words text-sm text-[var(--app-muted)]">{subtitle}</p>
        </div>
      </div>

      {footer ? (
        <div className="mt-4" data-space-no-drag="true">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
