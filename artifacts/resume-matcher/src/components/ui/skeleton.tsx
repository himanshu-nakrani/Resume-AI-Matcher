import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-[linear-gradient(90deg,hsl(var(--surface-2))_25%,hsl(var(--surface-3))_50%,hsl(var(--surface-2))_75%)] bg-[length:200%_100%] animate-[skeleton-shimmer_1.2s_linear_infinite]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
