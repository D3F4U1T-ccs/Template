import { Link, useLocation } from "react-router-dom";

import { navItems } from "@/data/app-config";
import { cn } from "@/shared/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export function Sidebar() {
  const location = useLocation();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <div className="group h-full">
          <div className="flex h-full w-20 flex-col gap-3 overflow-hidden border-r border-[var(--app-border)] bg-[var(--app-sidebar)] px-3 py-4 backdrop-blur transition-[width] duration-300 ease-out group-hover:w-64 group-focus-within:w-64">
            <div className="flex h-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] text-sm font-semibold text-[var(--app-text)]">
              T
            </div>

            <nav className="flex flex-1 flex-col gap-2">
              {navItems.map((item) => {
                const active = isActive(location.pathname, item.href);

                return (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition",
                      active
                        ? "bg-[var(--app-brand-soft)] text-[var(--app-text)]"
                        : "text-[var(--app-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--app-text)]"
                    )}
                    key={item.key}
                    to={item.href}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                        active
                          ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)]"
                          : "border-[var(--app-border)] bg-[var(--app-panel-soft)]"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium opacity-0 transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-sidebar)] p-2 shadow-[var(--shadow-soft)] backdrop-blur lg:hidden">
        {navItems.map((item) => {
          const active = isActive(location.pathname, item.href);

          return (
            <Link
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition",
                active
                  ? "bg-[var(--app-brand-soft)] text-[var(--app-text)]"
                  : "text-[var(--app-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--app-text)]"
              )}
              key={item.key}
              to={item.href}
            >
              <item.icon className="h-4 w-4" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
