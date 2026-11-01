import type * as React from "react"

import { cn } from "@/lib/utils"

const avatarColors = {
  coral: "bg-brand-coral/15 text-brand-coral",
  teal: "bg-brand-teal/20 text-foreground",
  lemon: "bg-brand-lemon text-accent-foreground",
  sky: "bg-brand-sky text-foreground",
  lilac: "bg-brand-lilac text-foreground",
} as const

interface AvatarProps extends React.ComponentProps<"span"> {
  name: string
  emoji?: string
  color?: keyof typeof avatarColors
  size?: "sm" | "md" | "lg"
}

function Avatar({
  name,
  emoji,
  color = "teal",
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("it-IT")

  return (
    <span
      role="img"
      aria-label={`Avatar di ${name}`}
      data-slot="avatar"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-heading font-bold ring-2 ring-background",
        avatarColors[color],
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-12 text-base",
        className
      )}
      {...props}
    >
      {emoji ?? initials}
    </span>
  )
}

export { Avatar }
