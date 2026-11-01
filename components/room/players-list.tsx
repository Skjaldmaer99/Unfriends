import { UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PlayerCard } from "@/components/ui/player-card"
import type { LobbyRoom } from "@/components/room/use-room-lobby"

interface PlayersListProps {
  room: LobbyRoom
  readyByPlayerId: Record<string, boolean>
  isHost: boolean
}

function PlayersList({ room, readyByPlayerId, isHost }: PlayersListProps) {
  return (
    <section aria-labelledby="players-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="players-title" className="font-heading text-xl font-bold">
            Al tavolo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isHost
              ? "Sei l'host della stanza."
              : "Aspetta che l'host avvii la partita."}
          </p>
        </div>
        <Badge variant="secondary">
          <UsersRound aria-hidden="true" />
          {room.playerCount}/{room.maxPlayers}
        </Badge>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {room.players.map((player) => (
          <li key={player.id}>
            <PlayerCard
              nickname={player.nickname}
              avatar={player.avatar}
              score={player.score}
              isHost={player.isHost}
              isConnected={player.connectionStatus === "connected"}
              isCurrentPlayer={player.id === room.selfPlayerId}
              isReady={readyByPlayerId[player.id] ?? false}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export { PlayersList }
