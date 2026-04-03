import { cn } from "@/shared/lib/utils";

import type { BoardTextItem } from "@/types/models";

export function BoardTextCard({
  item,
  className,
  menu,
}: {
  item: BoardTextItem;
  className?: string;
  menu?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border border-[var(--app-border)] bg-transparent p-4 shadow-[var(--shadow-soft)]",
        item.tone === "soft" && "bg-[var(--app-panel)]/88 backdrop-blur",
        className
      )}
      style={{ borderRadius: item.cornerRadius }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="min-h-0 flex-1 whitespace-pre-wrap break-words leading-[1.15]"
          style={{
            color: item.textColor,
            fontFamily: item.fontFamily,
            fontSize: `${item.fontSize}px`,
          }}
        >
          {item.content || " "}
        </div>
        {menu ? <div data-space-no-drag="true">{menu}</div> : null}
      </div>
    </div>
  );
}
