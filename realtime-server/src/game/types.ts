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
] as const

export const QuestionCategorySchema = z.enum(QUESTION_CATEGORIES)

export const GameSettingsSchema = z.object({
  roundsPerPlayer: z.number().int().min(1).max(5).default(1),
  answerTimeLimitSeconds: z.number().int().min(10).max(300).default(60),
  selectionTimeLimitSeconds: z.number().int().min(5).max(120).default(30),
  enabledCategories: z
    .array(QuestionCategorySchema)
    .min(1)
    .default([...QUESTION_CATEGORIES]),
})

export const GameQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  category: QuestionCategorySchema,
  difficulty: z.enum(["easy", "medium", "hard"]),
})

export type GameSettingsInput = z.input<typeof GameSettingsSchema>
export type GameSettings = z.output<typeof GameSettingsSchema>
export type GameQuestion = z.infer<typeof GameQuestionSchema>
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
  playerId: string
  content: string
  createdAt: number
}

export interface GameRound {
  id: string
  number: number
  protagonistId: string
  question: GameQuestion
  phase: RoundPhase
  deadlineAt: number | null
  originalAnswer: string | null
  answers: GameAnswer[]
  selectedAnswerId: string | null
}

export interface GameState {
  status: "in_progress" | "finished"
  players: GamePlayer[]
  settings: GameSettings
  questionBank: GameQuestion[]
  usedQuestionIds: string[]
  totalRounds: number
  currentRound: GameRound
}

export const GameStateSnapshotSchema = z.object({
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
    answers: z.array(
      z.object({
        id: z.string().min(1),
        playerId: z.string().min(1),
        content: z.string().min(1).max(240),
        createdAt: z.number().finite().nonnegative(),
      })
    ),
    selectedAnswerId: z.string().nullable(),
  }),
})

export interface PlayerAnswerView {
  id: string
  content: string
  authorId?: string
  authorNickname?: string
}

export interface PlayerGameView {
  status: GameState["status"]
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
    hasSubmittedAnswer: boolean
    originalAnswer?: string
    answers: PlayerAnswerView[]
    selectedAnswerId: string | null
  }
}
