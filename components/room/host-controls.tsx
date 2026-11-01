import { Button } from "@/components/ui/button"
import { GameSettingsPanel } from "@/components/room/game-settings-panel"
import type { LobbyRoom } from "@/components/room/use-room-lobby"
import type { GameSettings } from "@/realtime-server/src/game/types"

interface HostControlsProps {
  room: LobbyRoom
  connectedPlayers: number
  isHost: boolean
  isConnected: boolean
  isSavingSettings: boolean
  isStarting: boolean
  onSaveSettings: (settings: GameSettings) => Promise<void>
  onStart: () => Promise<void>
}

function HostControls({
  room,
  connectedPlayers,
  isHost,
  isConnected,
  isSavingSettings,
  isStarting,
  onSaveSettings,
  onStart,
}: HostControlsProps) {
  if (room.status !== "waiting") return null

  if (!isHost) {
    return (
      <p className="border-t border-border pt-5 text-center text-sm text-muted-foreground">
        In attesa che l&apos;host avvii la partita.
      </p>
    )
  }

  const canStart = connectedPlayers >= 3

  return (
    <div className="space-y-5 border-t border-border pt-5">
      <GameSettingsPanel
        key={JSON.stringify(room.settings)}
        settings={room.settings}
        disabled={!isConnected}
        saving={isSavingSettings}
        onSave={onSaveSettings}
      />
      <div>
        <Button
          className="w-full"
          size="lg"
          onPress={() => void onStart()}
          isDisabled={!canStart || !isConnected || isStarting}
        >
          {isStarting ? "Avvio…" : "Avvia la partita"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {connectedPlayers < 3
            ? `Servono ancora ${3 - connectedPlayers} giocatori connessi.`
            : "Con almeno 3 giocatori, il tavolo è pronto."}
        </p>
      </div>
    </div>
  )
}

export { HostControls }
