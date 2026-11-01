import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const avatarEmoji: Record<string, string> = {
  sun: "☀️",
  sparkle: "✨",
  flower: "🌼",
  leaf: "🍃",
  moon: "🌙",
  star: "⭐",
  cherry: "🍒",
  wave: "🌊",
}

interface PlayerReadyControlProps {
  nickname: string
  avatar: string
  isReady: boolean
  isConnected: boolean
  onToggle: () => void
}

function PlayerReadyControl({
  nickname,
  avatar,
  isReady,
  isConnected,
  onToggle,
}: PlayerReadyControlProps) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar
            name={nickname}
            emoji={avatarEmoji[avatar]}
            color="lemon"
            size="sm"
          />
          <div>
            <p className="text-sm font-semibold">La tua prontezza</p>
            <p className="text-xs text-muted-foreground">
              {isReady
                ? "Hai detto che sei pronto."
                : "Segnala all'host che ci sei."}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isReady ? "secondary" : "outline"}
          onPress={onToggle}
          isDisabled={!isConnected}
        >
          {isReady ? "Pronto" : "Sono pronto"}
        </Button>
      </div>
    </div>
  )
}

export { PlayerReadyControl }
