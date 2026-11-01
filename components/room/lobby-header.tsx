import Link from "next/link"
import { ArrowLeft, DoorOpen } from "lucide-react"

import { Button } from "@/components/ui/button"

interface LobbyHeaderProps {
  isLeaving: boolean
  onLeave: () => void
}

function LobbyHeader({ isLeaving, onLeave }: LobbyHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        className="inline-flex min-w-0 items-center gap-2 font-heading font-bold"
        href="/"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-coral text-primary-foreground">
          <DoorOpen aria-hidden="true" className="size-5" />
        </span>
        <span className="truncate">Chi mi conosce davvero?</span>
      </Link>
      <Button
        size="sm"
        variant="ghost"
        onPress={onLeave}
        isDisabled={isLeaving}
      >
        <ArrowLeft aria-hidden="true" />
        Esci
      </Button>
    </header>
  )
}

export { LobbyHeader }
