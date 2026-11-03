import { getGameModeDefinition } from "../game-modes.js"
import type { GameAnswer, GamePlayer, GameState, GameVote } from "../types.js"

export function getEligibleVoterCount(
    players: readonly GamePlayer[],
    answers: readonly GameAnswer[]
): number {
    return players.filter((player) =>
        answers.some((answer) => answer.playerId !== player.id)
    ).length
}

export function resolveAbsurdVotes(
    state: GameState,
    votes: readonly GameVote[]
): GameState {
    const scoring = getGameModeDefinition("absurd_situations").scoring
    const votesByAnswer = new Map<string, number>()
    for (const vote of votes) {
        votesByAnswer.set(
            vote.answerId,
            (votesByAnswer.get(vote.answerId) ?? 0) + 1
        )
    }

    const highestVoteCount = Math.max(0, ...votesByAnswer.values())
    const selectedAnswerIds = [...votesByAnswer.entries()]
        .filter(([, voteCount]) => voteCount === highestVoteCount && voteCount > 0)
        .map(([answerId]) => answerId)
    const selectedPlayerIds = new Set(
        state.currentRound.answers
            .filter((answer) => selectedAnswerIds.includes(answer.id))
            .map((answer) => answer.playerId)
    )
    const winningVoterIds = new Set(
        votes
            .filter((vote) => selectedAnswerIds.includes(vote.answerId))
            .map((vote) => vote.playerId)
    )
    const players = state.players.map((player) => ({
        ...player,
        score:
            player.score +
            (selectedPlayerIds.has(player.id) ? scoring.winningAnswerPoints : 0) +
            (winningVoterIds.has(player.id) ? scoring.winningVoteBonus : 0),
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
        },
    }
}