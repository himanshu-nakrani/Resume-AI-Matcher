import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "shimmer" | "pulse" | "wave"
}

function Skeleton({ className, variant = "shimmer", ...props }: SkeletonProps) {
  const variantClasses = {
    default: "bg-muted",
    shimmer: "shimmer bg-muted",
    pulse: "animate-pulse bg-muted",
    wave: "shimmer bg-gradient-to-r from-muted via-muted/50 to-muted",
  }

  return (
    <div
      className={cn(
        "rounded-md",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }