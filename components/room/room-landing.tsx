"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { HostControls } from "@/components/room/host-controls"
import { LobbyFooter } from "@/components/room/lobby-footer"
import { LobbyHeader } from "@/components/room/lobby-header"
import { PlayerReadyControl } from "@/components/room/player-ready-control"
import { PlayersList } from "@/components/room/players-list"
import { RoomCodeCard } from "@/components/room/room-code-card"
import { useRoomLobby } from "@/components/room/use-room-lobby"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { toast } from "@/components/ui/sonner"
import type { GameSettings } from "@/realtime-server/src/game/types"

function RoomLanding({ code }: { code: string }) {
  const router = useRouter()
  const lobby = useRoomLobby(code)
  const [copied, setCopied] = useState(false)
  const room = lobby.room
  const connectedPlayers =
    room?.players.filter((player) => player.connectionStatus === "connected")
      .length ?? 0
  const currentPlayer = room?.players.find(
    (player) => player.id === room.selfPlayerId
  )
  const isHost = currentPlayer?.isHost ?? false

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success("Codice copiato")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Non siamo riusciti a copiare il codice")
    }
  }

  async function shareRoom() {
    const inviteUrl = `${window.location.origin}/room/${encodeURIComponent(code)}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Chi mi conosce davvero?",
          text: `Unisciti alla mia partita con il codice ${code}`,
          url: inviteUrl,
        })
      } else {
        await navigator.clipboard.writeText(inviteUrl)
        toast.success("Link d'invito copiato")
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      toast.error("Non siamo riusciti a condividere il link")
    }
  }

  async function handleLeave() {
    if (await lobby.leaveRoom()) router.push("/")
  }

  async function saveSettings(settings: GameSettings) {
    await lobby.saveSettings(settings)
  }

  if (lobby.isLoading) {
    return <LoadingState label="Prepariamo il tavolo…" fullHeight />
  }

  if (lobby.error || !room) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-5 py-10">
        <p className="text-xs font-bold text-brand-coral uppercase">
          Stanza non disponibile
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold">
          Non troviamo il tavolo
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {lobby.error || "La stanza potrebbe essere stata chiusa."}
        </p>
        <Button className="mt-6 w-fit" onPress={() => router.push("/")}>
          Torna alla home
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-svh px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <LobbyHeader isLeaving={lobby.isLeaving} onLeave={handleLeave} />
        <RoomCodeCard
          code={room.code}
          playerCount={room.playerCount}
          connectedCount={connectedPlayers}
          maxPlayers={room.maxPlayers}
          isConnected={lobby.isConnected}
          copied={copied}
          status={room.status}
          onCopy={copyRoomCode}
          onShare={shareRoom}
        />

        <div className="grid gap-8 py-7 lg:grid-cols-[1fr_0.95fr] lg:gap-10 lg:py-9">
          <section className="space-y-4">
            <PlayersList
              room={room}
              readyByPlayerId={lobby.readyByPlayerId}
              isHost={isHost}
            />
            {room.status === "waiting" && currentPlayer && (
              <PlayerReadyControl
                nickname={currentPlayer.nickname}
                avatar={currentPlayer.avatar}
                isReady={lobby.selfReady}
                isConnected={lobby.isConnected}
                onToggle={() => void lobby.setReady(!lobby.selfReady)}
              />
            )}
          </section>

          <section className="space-y-5">
            <HostControls
              room={room}
              connectedPlayers={connectedPlayers}
              isHost={isHost}
              isConnected={lobby.isConnected}
              isSavingSettings={lobby.isSavingSettings}
              isStarting={lobby.isStarting}
              onSaveSettings={saveSettings}
              onStart={lobby.startGame}
            />
          </section>
        </div>

        <LobbyFooter
          gameStarted={lobby.gameStarted}
          actionError={lobby.actionError}
        />
      </div>
    </main>
  )
}

export { RoomLanding }
