import { UsersRound } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScoreBadge } from "@/components/ui/score-badge"
import type { LobbyRoom } from "@/components/room/use-room-lobby"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

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

interface GameHeaderProps {
    code: string
    room: LobbyRoom | null
    view: PlayerGameView
}

function GameHeader({ code, room, view }: GameHeaderProps) {
    const connectionStatusByPlayerId = new Map(
        room?.players.map((player) => [player.id, player.connectionStatus]) ?? []
    )
    const orderedPlayers = [...view.players].sort(
        (first, second) =>
            second.score - first.score ||
            first.nickname.localeCompare(second.nickname, "it")
    )

    return (
        <header className="space-y-4 border-b border-border pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-heading font-bold">Chi mi conosce davvero?</p>
                <Badge variant="secondary" className="font-mono tracking-wider">
                    {code}
                </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold text-brand-coral uppercase">
                        Round {view.currentRound.number} di {view.totalRounds}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <UsersRound aria-hidden="true" className="size-4" />
                        {view.players.length} al tavolo
                    </p>
                </div>
                {room && (
                    <div className="flex -space-x-2" aria-label="Giocatori">
                        {room.players.slice(0, 5).map((player) => (
                            <Avatar
                                key={player.id}
                                name={player.nickname}
                                emoji={avatarEmoji[player.avatar]}
                                color={player.isHost ? "lemon" : "teal"}
                                size="sm"
                                title={player.nickname}
                            />
                        ))}
                        {room.players.length > 5 && (
                            <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-bold ring-2 ring-background">
                                +{room.players.length - 5}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {orderedPlayers.map((player) => (
                    <li
                        key={player.id}
                        className="flex min-w-0 items-center gap-2 rounded-lg bg-card/80 px-2.5 py-2"
                    >
                        <Avatar
                            name={player.nickname}
                            emoji={avatarEmoji[player.avatar ?? "sun"]}
                            color={player.isProtagonist ? "lemon" : "teal"}
                            size="sm"
                        />
                        {connectionStatusByPlayerId.has(player.id) && (
                            <span
                                className={`size-2 shrink-0 rounded-full ${connectionStatusByPlayerId.get(player.id) === "connected" ? "bg-brand-teal" : "bg-brand-coral"}`}
                                role="img"
                                aria-label={`${player.nickname}: ${connectionStatusByPlayerId.get(player.id) === "connected" ? "connesso" : "disconnesso"}`}
                                title={
                                    connectionStatusByPlayerId.get(player.id) === "connected"
                                        ? "Connesso"
                                        : "Disconnesso"
                                }
                            />
                        )}
                        <span
                            className="min-w-0 flex-1 break-words text-sm leading-tight font-medium"
                            title={player.nickname}
                        >
                            {player.nickname}
                        </span>
                        <ScoreBadge score={player.score} />
                    </li>
                ))}
            </ol>
        </header>
    )
}

export { GameHeader }
