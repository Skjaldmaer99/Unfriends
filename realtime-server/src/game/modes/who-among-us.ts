import { randomUUID } from "node:crypto"

import { getGameModeDefinition } from "../game-modes.js"
import type { GameState, GameVote } from "../types.js"

export function createWhoAmongUsCandidates(
    statePlayers: GameState["players"],
    now: number
): GameState["currentRound"]["answers"] {
    return statePlayers.map((player) => ({
        id: randomUUID(),
        playerId: player.id,
        content: player.nickname,
        createdAt: now,
    }))
}

export function resolveWhoAmongUsVotes(
    state: GameState,
    votes: readonly GameVote[]
): GameState {
    const votesByCandidate = new Map<string, number>()
    for (const vote of votes) {
        votesByCandidate.set(
            vote.answerId,
            (votesByCandidate.get(vote.answerId) ?? 0) + 1
        )
    }

    const highestVoteCount = Math.max(0, ...votesByCandidate.values())
    const selectedAnswerIds = [...votesByCandidate.entries()]
        .filter(([, voteCount]) => voteCount === highestVoteCount && voteCount > 0)
        .map(([answerId]) => answerId)
    const winningVoterIds = new Set(
        votes
            .filter((vote) => selectedAnswerIds.includes(vote.answerId))
            .map((vote) => vote.playerId)
    )
    const scoring = getGameModeDefinition("who_among_us").scoring
    const players = state.players.map((player) => ({
        ...player,
        score: state.settings.scoringEnabled
            ? player.score +
            (selectedAnswerIds.some((answerId) =>
                state.currentRound.answers.some(
                    (answer) => answer.id === answerId && answer.playerId === player.id
                )
            )
                ? scoring.winningAnswerPoints
                : 0) +
            (winningVoterIds.has(player.id) ? scoring.winningVoteBonus : 0)
            : player.score,
    }))

    return {
        ...state,
        players,
        currentRound: {
            ...state.currentRound,
            votes: [...votes],
            phase: "round_result",
            deadlineAt: null,
            selectedAnswerIds,
            whoVoteCounts: [...votesByCandidate.entries()].map(
                ([answerId, voteCount]) => ({ answerId, voteCount })
            ),
        },
    }
}