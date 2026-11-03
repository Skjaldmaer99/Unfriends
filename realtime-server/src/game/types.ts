import { z } from "zod"

export const QUESTION_CATEGORIES = [
    "friendship",
    "personality",
    "preferences",
    "habits",
    "memories",
    "hypotheticals",
    "relationships",
    "fun",
    "absurd",
    "everyday_life",
    "travel",
    "general_knowledge",
    "embarrassing",
    "fantasy",
    "impossible_situations",
] as const

export const QuestionCategorySchema = z.enum(QUESTION_CATEGORIES)

export const GAME_MODES = [
    "classic",
    "absurd_situations",
    "bluff",
    "who_among_us",
    "secret_character",
] as const

export const GameModeSchema = z.enum(GAME_MODES)
export type GameMode = z.infer<typeof GameModeSchema>

export const GameSettingsSchema = z
    .object({
        mode: GameModeSchema.default("classic"),
        scoringEnabled: z.boolean().default(true),
        roundsPerPlayer: z.number().int().min(1).max(5).default(1),
        answerTimeLimitSeconds: z.number().int().min(10).max(300).default(60),
        selectionTimeLimitSeconds: z.number().int().min(5).max(120).default(30),
        enabledCategories: z
            .array(QuestionCategorySchema)
            .min(1)
            .default([...QUESTION_CATEGORIES]),
    })
    .strict()

export const GameQuestionSchema = z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1).max(500),
    category: QuestionCategorySchema,
    difficulty: z.enum(["easy", "medium", "hard"]),
})

export const BluffQuestionSchema = GameQuestionSchema.extend({
    correctAnswer: z.string().trim().min(1).max(300),
    explanation: z.string().trim().min(1).max(1200),
    sourceUrl: z.url().max(1000).refine((value) => value.startsWith("https://")),
})

export type GameSettingsInput = z.input<typeof GameSettingsSchema>
export type GameSettings = z.output<typeof GameSettingsSchema>
export type GameQuestion = z.infer<typeof GameQuestionSchema>
export type BluffQuestion = z.infer<typeof BluffQuestionSchema>
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>

export interface GamePlayerInput {
    id: string
    nickname: string
    avatar?: string
}

export interface GamePlayer extends GamePlayerInput {
    score: number
}

export type RoundPhase =
    | "protagonist_answer"
    | "players_answer"
    | "reveal"
    | "protagonist_selection"
    | "round_result"
    | "finished"

export interface GameAnswer {
    id: string
    playerId: string | null
    content: string
    createdAt: number
    isCorrectAnswer?: boolean
}

export interface GameVote {
    playerId: string
    answerId: string
}

export interface GameRound {
    id: string
    number: number
    protagonistId: string
    question: GameQuestion
    phase: RoundPhase
    deadlineAt: number | null
    originalAnswer: string | null
    bluffCorrectAnswer: string | null
    bluffExplanation: string | null
    bluffSourceUrl: string | null
    bluffCorrectAnswerId: string | null
    bluffVoteCounts: Array<{ answerId: string; voteCount: number }>
    whoVoteCounts: Array<{ answerId: string; voteCount: number }>
    answers: GameAnswer[]
    votes: GameVote[]
    selectedAnswerIds: string[]
}

export interface GameState {
    status: "in_progress" | "finished"
    players: GamePlayer[]
    settings: GameSettings
    questionBank: GameQuestion[]
    bluffQuestionBank: BluffQuestion[]
    usedQuestionIds: string[]
    totalRounds: number
    currentRound: GameRound
}

function normalizeLegacyGameStateSnapshot(snapshot: unknown): unknown {
    if (!snapshot || typeof snapshot !== "object") return snapshot
    const record = snapshot as Record<string, unknown>
    if (!Array.isArray(record.bluffQuestionBank)) record.bluffQuestionBank = []
    const currentRound = record.currentRound
    if (!currentRound || typeof currentRound !== "object") return snapshot

    const round = currentRound as Record<string, unknown>
    const normalizedRound = { ...round }
    if (!("bluffCorrectAnswer" in normalizedRound)) normalizedRound.bluffCorrectAnswer = null
    if (!("bluffExplanation" in normalizedRound)) normalizedRound.bluffExplanation = null
    if (!("bluffSourceUrl" in normalizedRound)) normalizedRound.bluffSourceUrl = null
    if (!("bluffCorrectAnswerId" in normalizedRound)) normalizedRound.bluffCorrectAnswerId = null
    if (!Array.isArray(normalizedRound.bluffVoteCounts)) normalizedRound.bluffVoteCounts = []
    if (!Array.isArray(normalizedRound.whoVoteCounts)) normalizedRound.whoVoteCounts = []
    if (
        !("selectedAnswerIds" in normalizedRound) &&
        Object.prototype.hasOwnProperty.call(normalizedRound, "selectedAnswerId")
    ) {
        const { selectedAnswerId, ...legacyRound } = normalizedRound
        Object.assign(normalizedRound, {
            ...legacyRound,
            selectedAnswerIds:
                typeof selectedAnswerId === "string" ? [selectedAnswerId] : [],
        })
        delete normalizedRound.selectedAnswerId
    }
    if (!("votes" in normalizedRound)) normalizedRound.votes = []

    return {
        ...record,
        currentRound: normalizedRound,
    }
}

export const GameStateSnapshotSchema = z.preprocess(
    normalizeLegacyGameStateSnapshot,
    z.object({
        status: z.enum(["in_progress", "finished"]),
        players: z
            .array(
                z.object({
                    id: z.string().min(1),
                    nickname: z.string().trim().min(1),
                    avatar: z.string().optional(),
                    score: z.number().int().nonnegative(),
                })
            )
            .min(2),
        settings: GameSettingsSchema,
        questionBank: GameQuestionSchema.array().min(1),
        bluffQuestionBank: BluffQuestionSchema.array(),
        usedQuestionIds: z.array(z.string().min(1)),
        totalRounds: z.number().int().positive(),
        currentRound: z.object({
            id: z.string().min(1),
            number: z.number().int().positive(),
            protagonistId: z.string().min(1),
            question: GameQuestionSchema,
            phase: z.enum([
                "protagonist_answer",
                "players_answer",
                "reveal",
                "protagonist_selection",
                "round_result",
                "finished",
            ]),
            deadlineAt: z.number().finite().nonnegative().nullable(),
            originalAnswer: z.string().nullable(),
            bluffCorrectAnswer: z.string().nullable(),
            bluffExplanation: z.string().nullable(),
            bluffSourceUrl: z.string().url().nullable(),
            bluffCorrectAnswerId: z.string().nullable(),
            bluffVoteCounts: z.array(
                z.object({ answerId: z.string().min(1), voteCount: z.number().int().nonnegative() })
            ),
            whoVoteCounts: z.array(
                z.object({ answerId: z.string().min(1), voteCount: z.number().int().nonnegative() })
            ),
            answers: z.array(
                z.object({
                    id: z.string().min(1),
                    playerId: z.string().min(1).nullable(),
                    content: z.string().min(1).max(240),
                    createdAt: z.number().finite().nonnegative(),
                    isCorrectAnswer: z.boolean().optional(),
                })
            ),
            votes: z.array(
                z.object({
                    playerId: z.string().min(1),
                    answerId: z.string().min(1),
                })
            ),
            selectedAnswerIds: z.array(z.string().min(1)),
        }),
    })
)

export interface PlayerAnswerView {
    id: string
    content: string
    isOwnAnswer?: boolean
    authorId?: string
    authorNickname?: string
    isCorrectAnswer?: boolean
    voteCount?: number
}

export interface PlayerGameView {
    status: GameState["status"]
    mode: GameSettings["mode"]
    players: Array<GamePlayer & { isProtagonist: boolean }>
    totalRounds: number
    currentRound: {
        number: number
        protagonistId: string
        question: GameQuestion
        phase: RoundPhase
        deadlineAt: number | null
        answerCount: number
        requiredAnswerCount: number
        voteCount: number
        requiredVoteCount: number
        hasSubmittedAnswer: boolean
        hasSubmittedVote: boolean
        originalAnswer?: string
        bluffExplanation?: string
        bluffSourceUrl?: string
        answers: PlayerAnswerView[]
        selectedAnswerIds: string[]
    }
}
