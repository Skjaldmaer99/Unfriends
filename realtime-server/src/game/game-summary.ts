import type { GamePlayer } from "./types.js"
import type { GameMode } from "./types.js"

export interface SummaryRoundRecord {
    id: string
    protagonistId: string
}

export interface SummaryAnswerRecord {
    id: string
    roundId: string
    playerId: string | null
    content: string
    isOriginalAnswer: boolean
}

export interface SummaryVoteRecord {
    roundId: string
    selectedAnswerId: string
}

export interface SummaryInput {
    mode?: GameMode
    players: readonly GamePlayer[]
    rounds: readonly SummaryRoundRecord[]
    answers: readonly SummaryAnswerRecord[]
    votes: readonly SummaryVoteRecord[]
}

export interface GameRecognition {
    title: string
    playerId: string
    nickname: string
    detail: string
}

export interface GameSummary {
    roundsPlayed: number
    answersSubmitted: number
    votesCast: number
    winningVotes: number
    winningAnswers: number
    correctVotes: number
    originalAnswersGuessedExactly: number
    exactGuessPercentage: number
    recognitions: GameRecognition[]
}

export function buildGameSummary(input: SummaryInput): GameSummary {
    const mode = input.mode ?? "classic"
    const answersById = new Map(
        input.answers.map((answer) => [answer.id, answer])
    )
    const answersByRound = new Map<string, SummaryAnswerRecord[]>()
    const exactMatchesByPlayer = new Map<string, number>()
    const protagonistRoundsByPlayer = new Map<string, number>()
    const selectedAnswersByPlayer = new Map<string, number>()
    const votesByRound = new Map<string, Map<string, number>>()

    for (const answer of input.answers) {
        const roundAnswers = answersByRound.get(answer.roundId) ?? []
        roundAnswers.push(answer)
        answersByRound.set(answer.roundId, roundAnswers)
    }

    let exactMatches = 0
    for (const round of input.rounds) {
        protagonistRoundsByPlayer.set(
            round.protagonistId,
            (protagonistRoundsByPlayer.get(round.protagonistId) ?? 0) + 1
        )

        const roundAnswers = answersByRound.get(round.id) ?? []
        const original = roundAnswers.find((answer) => answer.isOriginalAnswer)
        if (!original) continue

        const originalWasGuessed = roundAnswers.some(
            (answer) =>
                !answer.isOriginalAnswer &&
                normalizeAnswer(answer.content) === normalizeAnswer(original.content)
        )
        if (originalWasGuessed) {
            exactMatches += 1
            exactMatchesByPlayer.set(
                round.protagonistId,
                (exactMatchesByPlayer.get(round.protagonistId) ?? 0) + 1
            )
        }
    }

    for (const vote of input.votes) {
        const roundVotes = votesByRound.get(vote.roundId) ?? new Map<string, number>()
        roundVotes.set(
            vote.selectedAnswerId,
            (roundVotes.get(vote.selectedAnswerId) ?? 0) + 1
        )
        votesByRound.set(vote.roundId, roundVotes)

        const selected = answersById.get(vote.selectedAnswerId)
        if (!selected || selected.isOriginalAnswer) continue
        if (selected.playerId) {
            selectedAnswersByPlayer.set(
                selected.playerId,
                (selectedAnswersByPlayer.get(selected.playerId) ?? 0) + 1
            )
        }
    }

    const winningAnswerIds = new Set<string>()
    for (const roundVotes of votesByRound.values()) {
        const highestVoteCount = Math.max(0, ...roundVotes.values())
        for (const [answerId, voteCount] of roundVotes) {
            if (voteCount === highestVoteCount && voteCount > 0) {
                winningAnswerIds.add(answerId)
            }
        }
    }
    const winningVotes = input.votes.filter((vote) =>
        winningAnswerIds.has(vote.selectedAnswerId)
    ).length
    const correctVotes = input.votes.filter((vote) =>
        answersById.get(vote.selectedAnswerId)?.isOriginalAnswer
    ).length

    const recognitions: GameRecognition[] = []
    const mostSelected = findLeaders(
        input.players,
        (player) => selectedAnswersByPlayer.get(player.id) ?? 0
    )
    if (mostSelected.value > 0) {
        for (const player of mostSelected.players) {
            recognitions.push({
                title:
                    mode === "bluff"
                        ? "Bluff più convincente"
                        : mode === "who_among_us"
                            ? "Più votato"
                            : "Miglior osservatore",
                playerId: player.id,
                nickname: player.nickname,
                detail:
                    mode === "bluff"
                        ? `${mostSelected.value} ${mostSelected.value === 1 ? "voto" : "voti"} al bluff`
                        : mode === "who_among_us"
                            ? `${mostSelected.value} ${mostSelected.value === 1 ? "voto ricevuto" : "voti ricevuti"}`
                            : `${mostSelected.value} risposte scelte`,
            })
        }
    }

    if (mode === "classic") {
        const hardestToGuess = findLeaders(input.players, (player) => {
            const protagonistRounds = protagonistRoundsByPlayer.get(player.id) ?? 0
            const guessed = exactMatchesByPlayer.get(player.id) ?? 0
            return Math.max(0, protagonistRounds - guessed)
        })
        if (hardestToGuess.value > 0) {
            for (const player of hardestToGuess.players) {
                const protagonistRounds = protagonistRoundsByPlayer.get(player.id) ?? 0
                const guessed = exactMatchesByPlayer.get(player.id) ?? 0
                recognitions.push({
                    title: "Il più difficile da indovinare",
                    playerId: player.id,
                    nickname: player.nickname,
                    detail: `${guessed} risposte esatte su ${protagonistRounds}`,
                })
            }
        }
    }

    return {
        roundsPlayed: input.rounds.length,
        answersSubmitted:
            mode === "bluff"
                ? input.answers.filter((answer) => !answer.isOriginalAnswer).length
                : mode === "who_among_us"
                    ? 0
                    : input.answers.length,
        votesCast: input.votes.length,
        winningVotes,
        winningAnswers: winningAnswerIds.size,
        correctVotes,
        originalAnswersGuessedExactly: mode === "classic" ? exactMatches : 0,
        exactGuessPercentage:
            mode !== "classic" || input.rounds.length === 0
                ? 0
                : Math.round((exactMatches / input.rounds.length) * 100),
        recognitions,
    }
}

function normalizeAnswer(answer: string): string {
    return answer.normalize("NFKC").trim().toLocaleLowerCase("it-IT")
}

function findLeaders(
    players: readonly GamePlayer[],
    valueForPlayer: (player: GamePlayer) => number
): { value: number; players: GamePlayer[] } {
    let highest = 0
    let leaders: GamePlayer[] = []

    for (const player of players) {
        const value = valueForPlayer(player)
        if (value > highest) {
            highest = value
            leaders = [player]
        } else if (value === highest && value > 0) {
            leaders.push(player)
        }
    }

    return { value: highest, players: leaders }
}
