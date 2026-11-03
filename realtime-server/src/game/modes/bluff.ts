import { getGameModeDefinition } from "../game-modes.js"
import type { GameAnswer, GameState, GameVote } from "../types.js"

export function prepareBluffOptions(
    state: GameState,
    now: number,
    random: () => number
): GameState {
    const round = state.currentRound
    if (
        !round.bluffCorrectAnswer ||
        !round.bluffCorrectAnswerId ||
        round.answers.some((answer) => answer.isCorrectAnswer)
    ) {
        return state
    }

    const options: GameAnswer[] = [
        ...round.answers,
        {
            id: round.bluffCorrectAnswerId,
            playerId: null,
            content: round.bluffCorrectAnswer,
            createdAt: now,
            isCorrectAnswer: true,
        },
    ]
    return {
        ...state,
        currentRound: {
            ...round,
            answers: shuffle(options, random),
        },
    }
}

export function resolveBluffVotes(
    state: GameState,
    votes: readonly GameVote[]
): GameState {
    const scoring = getGameModeDefinition("bluff").scoring
    const answerById = new Map(
        state.currentRound.answers.map((answer) => [answer.id, answer])
    )
    const votesByAnswer = new Map<string, number>()
    const players = state.players.map((player) => ({ ...player }))

    for (const vote of votes) {
        const answer = answerById.get(vote.answerId)
        if (!answer) continue
        votesByAnswer.set(vote.answerId, (votesByAnswer.get(vote.answerId) ?? 0) + 1)

        if (answer.isCorrectAnswer) {
            const voter = players.find((player) => player.id === vote.playerId)
            if (voter) voter.score += scoring.correctAnswerPoints
        } else if (answer.playerId) {
            const author = players.find((player) => player.id === answer.playerId)
            if (author) author.score += scoring.bluffPerVotePoints
        }
    }

    const correctAnswerId = state.currentRound.bluffCorrectAnswerId
    return {
        ...state,
        players,
        currentRound: {
            ...state.currentRound,
            votes: [...votes],
            phase: "round_result",
            deadlineAt: null,
            selectedAnswerIds: correctAnswerId ? [correctAnswerId] : [],
            bluffVoteCounts: [...votesByAnswer.entries()].map(
                ([answerId, voteCount]) => ({ answerId, voteCount })
            ),
        },
    }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
    const result = [...values]
    for (let index = result.length - 1; index > 0; index -= 1) {
        const value = random()
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new RangeError("Random source must return a value in [0, 1).")
        }
        const swapIndex = Math.floor(value * (index + 1))
            ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
    }
    return result
}
