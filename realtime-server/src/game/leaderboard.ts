import type { GamePlayer } from "./types.js"

export interface RankedGamePlayer {
    player: GamePlayer
    rank: number
}

export function rankGamePlayers(
    players: readonly GamePlayer[]
): RankedGamePlayer[] {
    const orderedPlayers = [...players].sort(
        (first, second) =>
            second.score - first.score ||
            first.nickname.localeCompare(second.nickname, "it")
    )
    let previousScore: number | undefined
    let rank = 0

    return orderedPlayers.map((player, index) => {
        if (player.score !== previousScore) rank = index + 1
        previousScore = player.score
        return { player, rank }
    })
}