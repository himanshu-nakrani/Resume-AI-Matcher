import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-8 w-full rounded-md border border-border bg-surface-3 px-2.5 text-[13px] text-foreground transition-colors",
          "file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-foreground",
          "placeholder:text-subtle-foreground",
          "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-[error=true]:border-destructive data-[error=true]:focus-visible:ring-destructive/20",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
