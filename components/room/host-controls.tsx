import { Button } from "@/components/ui/button"
import { GameSettingsPanel } from "@/components/room/game-settings-panel"
import type { LobbyRoom } from "@/components/room/use-room-lobby"
import { getGameModeDefinition } from "@/realtime-server/src/game/game-modes"
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

    const selectedMode = getGameModeDefinition(room.settings.mode)

    if (!isHost) {
        return (
            <section className="space-y-2 border-t border-border pt-5 text-center">
                <p className="text-xs font-bold text-brand-coral uppercase">
                    Modalità selezionata
                </p>
                <h2 className="font-heading text-lg font-bold">{selectedMode.name}</h2>
                <p className="text-sm text-muted-foreground">
                    {selectedMode.description}
                </p>
                <p className="pt-2 text-sm text-muted-foreground">
                    In attesa che l&apos;host avvii la partita.
                </p>
            </section>
        )
    }

    const canStart =
        selectedMode.status === "available" &&
        connectedPlayers >= selectedMode.minPlayers &&
        connectedPlayers <= selectedMode.maxPlayers

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
                    {selectedMode.status !== "available"
                        ? "Questa modalità sarà disponibile in un aggiornamento futuro."
                        : connectedPlayers < selectedMode.minPlayers
                            ? `Servono ancora ${selectedMode.minPlayers - connectedPlayers} giocatori connessi.`
                            : connectedPlayers > selectedMode.maxPlayers
                                ? `Questa modalità supporta al massimo ${selectedMode.maxPlayers} giocatori.`
                                : `Con ${selectedMode.minPlayers}–${selectedMode.maxPlayers} giocatori, il tavolo è pronto.`}
                </p>
            </div>
        </div>
    )
}

export { HostControls }
