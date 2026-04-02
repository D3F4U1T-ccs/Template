import * as React from "react";
import { ArrowRight, Search } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      "h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 text-sm text-[var(--app-text)] outline-none transition",
      "placeholder:text-[var(--app-muted)] focus:border-[var(--app-brand)] focus:bg-[var(--card-hover)] focus:ring-2 focus:ring-[var(--app-brand-soft)]",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-[120px] w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition",
      "placeholder:text-[var(--app-muted)] focus:border-[var(--app-brand)] focus:bg-[var(--card-hover)] focus:ring-2 focus:ring-[var(--app-brand-soft)]",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    className={cn(
      "h-11 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 text-sm text-[var(--app-text)] outline-none transition",
      "focus:border-[var(--app-brand)] focus:bg-[var(--card-hover)] focus:ring-2 focus:ring-[var(--app-brand-soft)]",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--app-text)]">{label}</span>
        {hint ? <span className="text-xs text-[var(--app-muted)]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function CardSurface({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[var(--shadow-soft)] backdrop-blur",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        "border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)]",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-[var(--app-brand)] bg-[var(--app-brand-soft)] text-[var(--app-text)]"
          : "border-[var(--app-border)] bg-[var(--app-panel-soft)] text-[var(--app-muted)] hover:bg-[var(--card-hover)]"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <CardSurface className="flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-brand-soft)] p-3 text-[var(--app-brand)]">
        <ArrowRight className="h-5 w-5" />
      </div>
      {title ? (
        <h3 className="mt-4 text-lg font-semibold text-[var(--app-text)]">{title}</h3>
      ) : null}
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--app-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </CardSurface>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--app-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--app-text)]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
      <Input
        className="pl-10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <CardSurface className="p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--app-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--app-text)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--app-muted)]">{hint}</p>
    </CardSurface>
  );
}
