import * as React from "react"

import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glass" | "gradient-border" | "premium"
  hover?: "none" | "lift" | "glow" | "scale" | "glow-lift"
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = "none", ...props }, ref) => {
    const variantClasses = {
      default: "bg-card text-card-foreground border border-card-border shadow-sm",
      elevated: "bg-card text-card-foreground border border-card-border shadow-lg",
      glass: "glass-card text-card-foreground",
      "gradient-border": "gradient-border text-card-foreground shadow-sm",
      premium: "bg-card text-card-foreground shadow-lg border border-primary/10 dark:border-primary/20",
    }

    const hoverClasses = {
      none: "",
      lift: "hover:shadow-lg hover:-translate-y-1 transition-all duration-200",
      glow: "hover:shadow-primary hover:border-primary/50 transition-all duration-200",
      scale: "hover:scale-[1.02] transition-transform duration-200",
      "glow-lift": "hover:shadow-xl hover:-translate-y-1 border-glow transition-all duration-200",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl",
          variantClasses[variant],
          hoverClasses[hover],
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }