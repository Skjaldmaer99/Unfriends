import { Crown } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScoreBadge } from "@/components/ui/score-badge"
import { cn } from "@/lib/utils"

interface PlayerCardProps {
  nickname: string
  avatar: string
  score: number
  isHost?: boolean
  isConnected?: boolean
  isCurrentPlayer?: boolean
  className?: string
}

const avatarColorById = ["coral", "teal", "lemon", "sky", "lilac"] as const
const avatarEmojiById: Record<string, string> = {
  sun: "☀️",
  sparkle: "✨",
  flower: "🌼",
  leaf: "🍃",
  moon: "🌙",
  star: "⭐",
  cherry: "🍒",
  wave: "🌊",
}

function PlayerCard({
  nickname,
  avatar,
  score,
  isHost = false,
  isConnected = true,
  isCurrentPlayer = false,
  className,
}: PlayerCardProps) {
  const colorIndex = [...avatar].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  )
  const color = avatarColorById[colorIndex % avatarColorById.length]

  return (
    <Card
      className={cn(
        "flex min-w-0 items-center gap-3 p-3",
        !isConnected && "opacity-65",
        isCurrentPlayer && "border-brand-coral/50",
        className
      )}
    >
      <Avatar name={nickname} emoji={avatarEmojiById[avatar]} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate font-semibold">{nickname}</span>
          {isHost && (
            <Badge variant="accent">
              <Crown aria-hidden="true" />
              Host
            </Badge>
          )}
        </div>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              isConnected ? "bg-brand-teal" : "bg-muted-foreground"
            )}
          />
          {isConnected ? "Connesso" : "Disconnesso"}
        </span>
      </div>
      <ScoreBadge score={score} />
    </Card>
  )
}

export { PlayerCard }
