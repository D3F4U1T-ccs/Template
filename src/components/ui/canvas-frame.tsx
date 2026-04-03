import { cn } from "@/shared/lib/utils";

import { Badge } from "@/components/ui/primitives";

export function CanvasFrame({
  title,
  subtitle,
  count,
  accent,
  coverUrl,
  cornerRadius,
  placementWidth,
  isDragging,
  menu,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  accent: string;
  coverUrl?: string;
  cornerRadius: number;
  placementWidth: number;
  isDragging?: boolean;
  menu?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const titleClass =
    placementWidth >= 880 ? "text-lg" : placementWidth >= 620 ? "text-base" : "text-sm";

  return (
    <div className="relative h-full min-h-0 overflow-visible">
      <div
        className={cn(
          "group relative flex h-full min-h-0 cursor-grab flex-col border border-white/10 bg-black/70 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] active:cursor-grabbing",
          isDragging && "backdrop-blur-sm ring-1 ring-white/10"
        )}
        style={{ borderRadius: cornerRadius }}
      >
        {coverUrl ? (
          <img
            alt={title}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
            draggable={false}
            src={coverUrl}
            style={{ borderRadius: cornerRadius }}
          />
        ) : null}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-200 group-hover:opacity-30",
            `bg-gradient-to-br ${accent}`
          )}
          style={{ borderRadius: cornerRadius }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("truncate font-semibold text-white/95", titleClass)}>{title}</p>
            {subtitle ? (
              <p className="mt-1 truncate text-xs text-white/55">{subtitle}</p>
            ) : null}
          </div>
          {menu ? <div data-space-no-drag="true">{menu}</div> : null}
        </div>

        <div className="relative mt-4 min-h-0 flex-1">{children}</div>

        <div className="relative mt-4 flex justify-end">
          <Badge className="border-white/10 bg-black/30 text-white/70">{count}</Badge>
        </div>
      </div>
    </div>
  );
}
