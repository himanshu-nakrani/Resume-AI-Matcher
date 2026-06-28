import * as React from "react"

import { cn } from "@/lib/utils"

type CardPadding = "sm" | "default" | "lg"

const PADDING_VARS: Record<CardPadding, string> = {
  sm: "[--card-padding:0.75rem]",       // 12px
  default: "[--card-padding:1rem]",     // 16px
  lg: "[--card-padding:1.5rem]",        // 24px
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = "default", ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground border border-border rounded-lg",
        PADDING_VARS[padding],
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "flex flex-col space-y-1.5 p-[var(--card-padding,1rem)]",
      className,
    )}
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
    data-slot="card-title"
    className={cn("text-[15px] font-semibold leading-none tracking-tight", className)}
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
    data-slot="card-description"
    className={cn("text-[13px] text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("p-[var(--card-padding,1rem)] pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-[var(--card-padding,1rem)] pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
