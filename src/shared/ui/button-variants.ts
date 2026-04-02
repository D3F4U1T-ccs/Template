import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--app-brand)] text-white shadow-[var(--shadow-soft)] hover:opacity-95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-[var(--app-border)] bg-transparent text-[var(--app-text)] hover:bg-[var(--card-hover)]",
        secondary:
          "bg-[var(--app-panel-soft)] text-[var(--app-text)] hover:bg-[var(--card-hover)]",
        ghost: "text-[var(--app-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--app-text)]",
        link: "text-[var(--app-brand)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
