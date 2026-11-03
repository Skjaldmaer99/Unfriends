import {
    GameQuestionSchema,
    GameSettingsSchema,
    type GameAnswer,
    type GamePlayer,
    type GamePlayerInput,
    type GameQuestion,
    type GameSettings,
    type GameSettingsInput,
    type GameState,
    type PlayerGameView,
} from "./types.js"
import { getGameModeDefinition } from "./game-modes.js"
import {
    getEligibleVoterCount,
    resolveAbsurdVotes,
} from "./modes/absurd-situations.js"

export type GameRuleErrorCode =
    | "INVALID_PLAYER_COUNT"
    | "INVALID_PLAYER"
    | "DUPLICATE_PLAYER"
    | "DUPLICATE_QUESTION"
    | "NO_AVAILABLE_QUESTIONS"
    | "INVALID_RANDOM_VALUE"
    | "PLAYER_NOT_FOUND"
    | "WRONG_PHASE"
    | "NOT_PROTAGONIST"
    | "PROTAGONIST_CANNOT_GUESS"
    | "ANSWER_ALREADY_SUBMITTED"
    | "INVALID_ANSWER"
    | "ANSWER_EXPIRED"
    | "PHASE_NOT_EXPIRED"
    | "ANSWER_NOT_FOUND"
    | "NO_ANSWERS_SELECTED"
    | "DUPLICATE_SELECTED_ANSWER"
    | "VOTE_ALREADY_SUBMITTED"

export class GameRuleError extends Error {
    constructor(
        readonly code: GameRuleErrorCode,
        message: string
    ) {
        super(message)
        this.name = "GameRuleError"
    }
}

export interface CreateGameInput {
    players: readonly GamePlayerInput[]
    questions: readonly GameQuestion[]
    settings?: GameSettingsInput
    now?: number
    random?: () => number
}

const MAX_ANSWER_LENGTH = 240

export function createGame(input: CreateGameInput): GameState {
    const now = input.now ?? Date.now()
    assertTimestamp(now)

    if (input.players.length < 2) {
        throw new GameRuleError(
            "INVALID_PLAYER_COUNT",
            "A game needs at least two players."
        )
    }

    const playerIds = new Set<string>()
    const players: GamePlayer[] = input.players.map((player) => {
        const id = player.id.trim()
        const nickname = player.nickname.trim()

        if (!id || !nickname) {
            throw new GameRuleError(
                "INVALID_PLAYER",
                "Players need an id and nickname."
            )
        }

        if (playerIds.has(id)) {
            throw new GameRuleError("DUPLICATE_PLAYER", "Player ids must be unique.")
        }

        playerIds.add(id)
        return { ...player, id, nickname, score: 0 }
    })

    const questionBank = GameQuestionSchema.array().parse(input.questions)
    const questionIds = new Set<string>()
    for (const question of questionBank) {
        if (questionIds.has(question.id)) {
            throw new GameRuleError(
                "DUPLICATE_QUESTION",
                "Question ids must be unique."
            )
        }
        questionIds.add(question.id)
    }

    const settings = GameSettingsSchema.parse(input.settings ?? {})
    const question = chooseQuestion(
        questionBank,
        settings,
        [],
        input.random ?? Math.random
    )

    return {
        status: "in_progress",
        players,
        settings,
        questionBank,
        usedQuestionIds: [question.id],
        totalRounds: players.length * settings.roundsPerPlayer,
        currentRound: {
            id: "round-1",
            number: 1,
            protagonistId: players[0].id,
            question,
            phase:
                settings.mode === "absurd_situations"
                    ? "players_answer"
                    : "protagonist_answer",
            deadlineAt: now + settings.answerTimeLimitSeconds * 1000,
            originalAnswer: null,
            answers: [],
            votes: [],
            selectedAnswerIds: [],
        },
    }
}

export function submitProtagonistAnswer(
    state: GameState,
    playerId: string,
    content: string,
    now = Date.now()
): GameState {
    ensureActive(state)
    ensurePlayer(state, playerId)

    if (state.currentRound.phase !== "protagonist_answer") {
        throw new GameRuleError(
            "WRONG_PHASE",
            "The protagonist answer phase is closed."
        )
    }

    if (playerId !== state.currentRound.protagonistId) {
        throw new GameRuleError(
            "NOT_PROTAGONIST",
            "Only the protagonist can answer first."
        )
    }

    assertBeforeDeadline(state, now)

    return {
        ...state,
        currentRound: {
            ...state.currentRound,
            phase: "players_answer",
            deadlineAt: now + state.settings.answerTimeLimitSeconds * 1000,
            originalAnswer: normalizeAnswer(content),
        },
    }
}

export function submitPlayerAnswer(
    state: GameState,
    playerId: string,
    content: string,
    now = Date.now()
): GameState {
    ensureActive(state)
    ensurePlayer(state, playerId)

    if (state.currentRound.phase !== "players_answer") {
        throw new GameRuleError(
            "WRONG_PHASE",
            "Player answers are not being collected."
        )
    }

    if (
        state.settings.mode === "classic" &&
        playerId === state.currentRound.protagonistId
    ) {
        throw new GameRuleError(
            "PROTAGONIST_CANNOT_GUESS",
            "The protagonist cannot submit a guess."
        )
    }

    if (
        state.currentRound.answers.some((answer) => answer.playerId === playerId)
    ) {
        throw new GameRuleError(
            "ANSWER_ALREADY_SUBMITTED",
            "A player can submit only one answer per round."
        )
    }

    assertBeforeDeadline(state, now)

    const answer: GameAnswer = {
        id: `${state.currentRound.id}:${encodeURIComponent(playerId)}`,
        playerId,
        content: normalizeAnswer(content),
        createdAt: now,
    }
    const answers = [...state.currentRound.answers, answer]
    const requiredAnswerCount =
        state.settings.mode === "absurd_situations"
            ? state.players.length
            : state.players.length - 1
    const allPlayersAnswered = answers.length === requiredAnswerCount

    return {
        ...state,
        currentRound: {
            ...state.currentRound,
            answers,
            phase: allPlayersAnswered ? "reveal" : "players_answer",
            deadlineAt: allPlayersAnswered ? null : state.currentRound.deadlineAt,
        },
    }
}

export function beginSelection(state: GameState, now = Date.now()): GameState {
    ensureActive(state)
    assertTimestamp(now)

    if (state.currentRound.phase !== "reveal") {
        throw new GameRuleError(
            "WRONG_PHASE",
            "Answers are not ready for selection."
        )
    }

    return {
        ...state,
        currentRound: {
            ...state.currentRound,
            phase: "protagonist_selection",
            deadlineAt: now + state.settings.selectionTimeLimitSeconds * 1000,
        },
    }
}

export function expireCurrentPhase(
    state: GameState,
    now = Date.now()
): GameState {
    ensureActive(state)
    assertTimestamp(now)

    const round = state.currentRound
    if (
        round.deadlineAt === null ||
        now <= round.deadlineAt ||
        (round.phase !== "protagonist_answer" &&
            round.phase !== "players_answer" &&
            round.phase !== "protagonist_selection")
    ) {
        throw new GameRuleError(
            "PHASE_NOT_EXPIRED",
            "The current phase has not expired."
        )
    }

    if (
        state.settings.mode === "absurd_situations" &&
        round.phase === "players_answer" &&
        round.answers.length === state.players.length
    ) {
        return {
            ...state,
            currentRound: { ...round, phase: "reveal", deadlineAt: null },
        }
    }

    if (
        state.settings.mode === "absurd_situations" &&
        round.phase === "players_answer" &&
        round.answers.length === 0
    ) {
        return {
            ...state,
            currentRound: { ...round, phase: "round_result", deadlineAt: null },
        }
    }

    if (
        round.phase === "protagonist_answer" &&
        state.settings.mode === "classic"
    ) {
        return {
            ...state,
            currentRound: { ...round, phase: "round_result", deadlineAt: null },
        }
    }

    if (
        round.phase === "players_answer" &&
        round.answers.length > 0
    ) {
        return {
            ...state,
            currentRound: { ...round, phase: "reveal", deadlineAt: null },
        }
    }

    if (
        state.settings.mode === "absurd_situations" &&
        round.phase === "protagonist_selection"
    ) {
        return resolveAbsurdVotes(state, round.votes)
    }

    const selectorPoints = getGameModeDefinition(state.settings.mode).scoring.selectorPoints
    const players = state.players.map((player) =>
        player.id === round.protagonistId
            ? { ...player, score: player.score + selectorPoints }
            : player
    )

    return {
        ...state,
        players,
        currentRound: { ...round, phase: "round_result", deadlineAt: null },
    }
}

export function selectWinningAnswer(
    state: GameState,
    playerId: string,
    answerIds: readonly string[],
    now = Date.now()
): GameState {
    ensureActive(state)
    ensurePlayer(state, playerId)

    if (state.currentRound.phase !== "protagonist_selection") {
        throw new GameRuleError(
            "WRONG_PHASE",
            "The answer selection phase is closed."
        )
    }

    assertBeforeDeadline(state, now)

    if (state.settings.mode === "absurd_situations") {
        if (answerIds.length !== 1) {
            throw new GameRuleError(
                "INVALID_ANSWER",
                "Choose exactly one answer in this mode."
            )
        }
        if (state.currentRound.votes.some((vote) => vote.playerId === playerId)) {
            throw new GameRuleError(
                "VOTE_ALREADY_SUBMITTED",
                "A player can vote only once per round."
            )
        }
        const [answerId] = answerIds
        const answer = state.currentRound.answers.find(
            (candidate) => candidate.id === answerId
        )
        if (!answer) {
            throw new GameRuleError("ANSWER_NOT_FOUND", "The selected answer is invalid.")
        }
        if (answer.playerId === playerId) {
            throw new GameRuleError(
                "PROTAGONIST_CANNOT_GUESS",
                "A player cannot vote for their own answer."
            )
        }

        const votes = [...state.currentRound.votes, { playerId, answerId }]
        if (
            votes.length <
            getEligibleVoterCount(state.players, state.currentRound.answers)
        ) {
            return {
                ...state,
                currentRound: { ...state.currentRound, votes },
            }
        }
        return resolveAbsurdVotes(state, votes)
    }

    if (playerId !== state.currentRound.protagonistId) {
        throw new GameRuleError(
            "NOT_PROTAGONIST",
            "Only the protagonist can select an answer."
        )
    }

    if (answerIds.length === 0) {
        throw new GameRuleError(
            "NO_ANSWERS_SELECTED",
            "Select at least one answer."
        )
    }

    const selectedAnswerIds = [...new Set(answerIds)]
    if (selectedAnswerIds.length !== answerIds.length) {
        throw new GameRuleError(
            "DUPLICATE_SELECTED_ANSWER",
            "Selected answers cannot contain duplicates."
        )
    }

    const selectedAnswers = selectedAnswerIds.map((selectedAnswerId) =>
        state.currentRound.answers.find((answer) => answer.id === selectedAnswerId)
    )
    if (selectedAnswers.some((answer) => !answer)) {
        throw new GameRuleError(
            "ANSWER_NOT_FOUND",
            "One or more selected answers do not exist."
        )
    }

    if (selectedAnswers.some((answer) => answer?.playerId === playerId)) {
        throw new GameRuleError(
            "PROTAGONIST_CANNOT_GUESS",
            "A player cannot select their own answer."
        )
    }

    const selectedPlayerIds = new Set(
        selectedAnswers.map((answer) => answer!.playerId)
    )
    const scoring = getGameModeDefinition(state.settings.mode).scoring
    const players = state.players.map((player) => ({
        ...player,
        score:
            player.score +
            (player.id === state.currentRound.protagonistId
                ? scoring.selectorPoints
                : 0) +
            (selectedPlayerIds.has(player.id) ? scoring.winningAnswerPoints : 0),
    }))

    return {
        ...state,
        players,
        currentRound: {
            ...state.currentRound,
            phase: "round_result",
            deadlineAt: null,
            selectedAnswerIds,
        },
    }
}

export function advanceRound(
    state: GameState,
    now = Date.now(),
    random: () => number = Math.random
): GameState {
    ensureActive(state)

    if (state.currentRound.phase !== "round_result") {
        throw new GameRuleError(
            "WRONG_PHASE",
            "A round can advance only after its result."
        )
    }

    if (state.currentRound.number === state.totalRounds) {
        return {
            ...state,
            status: "finished",
            currentRound: {
                ...state.currentRound,
                phase: "finished",
            },
        }
    }

    assertTimestamp(now)
    const nextNumber = state.currentRound.number + 1
    const question = chooseQuestion(
        state.questionBank,
        state.settings,
        state.usedQuestionIds,
        random
    )
    const protagonist = state.players[(nextNumber - 1) % state.players.length]

    return {
        ...state,
        usedQuestionIds: [...state.usedQuestionIds, question.id],
        currentRound: {
            id: `round-${nextNumber}`,
            number: nextNumber,
            protagonistId: protagonist.id,
            question,
            phase: "protagonist_answer",
            deadlineAt: now + state.settings.answerTimeLimitSeconds * 1000,
            originalAnswer: null,
            answers: [],
            votes: [],
            selectedAnswerIds: [],
        },
    }
}

export function getPlayerGameView(
    state: GameState,
    playerId: string
): PlayerGameView {
    const viewer = ensurePlayer(state, playerId)
    const round = state.currentRound
    const resultIsVisible =
        round.phase === "round_result" || round.phase === "finished"
    const answersAreVisible =
        round.phase === "reveal" ||
        round.phase === "protagonist_selection" ||
        resultIsVisible
    const authorsAreVisible = resultIsVisible
    const canSeeOriginal =
        resultIsVisible ||
        (viewer.id === round.protagonistId && round.originalAnswer !== null)
    const playerById = new Map(state.players.map((player) => [player.id, player]))
    const answers = answersAreVisible
        ? round.answers.map((answer) => {
            if (!authorsAreVisible) {
                return {
                    id: answer.id,
                    content: answer.content,
                    ...(answer.playerId === viewer.id ? { isOwnAnswer: true } : {}),
                }
            }

            return {
                id: answer.id,
                content: answer.content,
                authorId: answer.playerId,
                authorNickname: playerById.get(answer.playerId)?.nickname,
            }
        })
        : []

    return {
        status: state.status,
        mode: state.settings.mode,
        players: state.players.map((player) => ({
            ...player,
            isProtagonist:
                state.settings.mode === "classic" &&
                player.id === round.protagonistId,
        })),
        totalRounds: state.totalRounds,
        currentRound: {
            number: round.number,
            protagonistId: round.protagonistId,
            question: round.question,
            phase: round.phase,
            deadlineAt: round.deadlineAt,
            answerCount: round.answers.length,
            requiredAnswerCount:
                state.settings.mode === "absurd_situations"
                    ? state.players.length
                    : state.players.length - 1,
            voteCount: round.votes.length,
            requiredVoteCount:
                state.settings.mode === "absurd_situations"
                    ? getEligibleVoterCount(state.players, round.answers)
                    : 0,
            hasSubmittedAnswer:
                state.settings.mode === "absurd_situations"
                    ? round.answers.some((answer) => answer.playerId === viewer.id)
                    : viewer.id === round.protagonistId
                        ? round.originalAnswer !== null
                        : round.answers.some((answer) => answer.playerId === viewer.id),
            hasSubmittedVote: round.votes.some((vote) => vote.playerId === viewer.id),
            ...(canSeeOriginal && round.originalAnswer !== null
                ? { originalAnswer: round.originalAnswer }
                : {}),
            answers,
            selectedAnswerIds: round.selectedAnswerIds,
        },
    }
}

function chooseQuestion(
    questionBank: readonly GameQuestion[],
    settings: GameSettings,
    usedQuestionIds: readonly string[],
    random: () => number
): GameQuestion {
    const enabledQuestions = questionBank.filter((question) =>
        settings.enabledCategories.includes(question.category)
    )
    if (enabledQuestions.length === 0) {
        throw new GameRuleError(
            "NO_AVAILABLE_QUESTIONS",
            "No questions match the enabled categories."
        )
    }

    const unusedQuestions = enabledQuestions.filter(
        (question) => !usedQuestionIds.includes(question.id)
    )
    const candidates =
        unusedQuestions.length > 0 ? unusedQuestions : enabledQuestions
    const randomValue = random()
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
        throw new GameRuleError(
            "INVALID_RANDOM_VALUE",
            "Random source must return a value in [0, 1)."
        )
    }

    return candidates[Math.floor(randomValue * candidates.length)]
}

function normalizeAnswer(content: string): string {
    if (typeof content !== "string") {
        throw new GameRuleError("INVALID_ANSWER", "Answers must be text.")
    }

    const normalized = content.trim()
    if (!normalized || normalized.length > MAX_ANSWER_LENGTH) {
        throw new GameRuleError(
            "INVALID_ANSWER",
            `Answers must contain between 1 and ${MAX_ANSWER_LENGTH} characters.`
        )
    }

    return normalized
}

function ensurePlayer(state: GameState, playerId: string): GamePlayer {
    const player = state.players.find((candidate) => candidate.id === playerId)
    if (!player) {
        throw new GameRuleError(
            "PLAYER_NOT_FOUND",
            "Player does not belong to this game."
        )
    }
    return player
}

function ensureActive(state: GameState): void {
    if (state.status !== "in_progress") {
        throw new GameRuleError("WRONG_PHASE", "The game has already finished.")
    }
}

function assertBeforeDeadline(state: GameState, now: number): void {
    assertTimestamp(now)
    if (
        state.currentRound.deadlineAt !== null &&
        now > state.currentRound.deadlineAt
    ) {
        throw new GameRuleError("ANSWER_EXPIRED", "The phase deadline has passed.")
    }
}

function assertTimestamp(timestamp: number): void {
    if (!Number.isFinite(timestamp) || timestamp < 0) {
        throw new RangeError("Timestamps must be finite non-negative numbers.")
    }
}
