import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[4px] border font-medium tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface-2 text-foreground",
        outline:
          "border-border bg-transparent text-foreground",
        solid:
          "border-transparent bg-accent text-accent-foreground",
        soft:
          "border-transparent bg-accent-soft text-accent",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        success:
          "border-transparent bg-[hsl(var(--success)/0.12)] text-success",
        warning:
          "border-transparent bg-[hsl(var(--warning)/0.12)] text-warning",
        info:
          "border-transparent bg-[hsl(var(--info)/0.12)] text-info",
      },
      size: {
        sm: "h-4 px-1.5 text-[10px]",
        default: "h-5 px-1.5 text-[10.5px]",
        lg: "h-6 px-2 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  onRemove?: () => void
  removeLabel?: string
}

function Badge({
  className,
  variant,
  size,
  icon,
  onRemove,
  removeLabel,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] transition-colors hover:bg-current/15"
          aria-label={removeLabel ?? "Remove badge"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-2.5 w-2.5"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

export { Badge, badgeVariants }
