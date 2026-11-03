import { z } from "zod"

import { GameSettingsSchema, type GameSettings } from "./game/types.js"
import type { PlayerGameView } from "./game/types.js"
import type { GameSummary } from "./game/game-summary.js"
export type { GameSummary } from "./game/game-summary.js"

const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/)

export const clientEventSchemas = {
  "room:leave": z.object({}).strict(),
  "room:start": z.object({}).strict(),
  "game:replay": z.object({}).strict(),
  "room:settings": z.object({ settings: GameSettingsSchema }).strict(),
  "player:ready": z.object({ ready: z.boolean() }).strict(),
  "answer:submit": z
    .object({
      content: z
        .string()
        .trim()
        .min(1)
        .max(240)
        .refine((content) => !content.includes("\u0000")),
    })
    .strict(),
  "answer:select": z
    .object({
      answerIds: z
        .array(z.string().min(1).max(128))
        .min(1)
        .max(7)
        .refine((answerIds) => new Set(answerIds).size === answerIds.length),
    })
    .strict(),
  "round:next": z.object({}).strict(),
} as const

export interface SocketPlayerSummary {
  id: string
  nickname: string
  avatar: string
  isHost: boolean
  score: number
  connectionStatus: "connected" | "disconnected"
}

export interface RoomSnapshot {
  code: string
  status: "waiting" | "in_progress" | "finished"
  maxPlayers: number
  playerCount: number
  settings: GameSettings
  players: SocketPlayerSummary[]
}
export interface EventFailure {
  ok: false
  code: string
  error: string
}

export interface EventSuccess<T = undefined> {
  ok: true
  data: T
}

export type EventAck<T = undefined> = (
  response: EventSuccess<T> | EventFailure
) => void

export interface ClientToServerEvents {
  "room:leave": (
    payload: Record<string, never>,
    ack: EventAck<{ roomClosed: boolean }>
  ) => void
  "room:start": (
    payload: Record<string, never>,
    ack: EventAck<{ started: true }>
  ) => void
  "room:settings": (
    payload: { settings: GameSettings },
    ack: EventAck<{ updated: true }>
  ) => void
  "player:ready": (
    payload: { ready: boolean },
    ack: EventAck<{ ready: boolean }>
  ) => void
  "answer:submit": (
    payload: { content: string },
    ack: EventAck<{ submitted: true }>
  ) => void
  "answer:select": (
    payload: { answerIds: string[] },
    ack: EventAck<{ selected: true }>
  ) => void
  "round:next": (
    payload: Record<string, never>,
    ack: EventAck<{ finished: boolean }>
  ) => void
  "game:replay": (
    payload: Record<string, never>,
    ack: EventAck<{ replayed: true }>
  ) => void
}

export interface ServerToClientEvents {
  "room:joined": (snapshot: RoomSnapshot) => void
  "room:updated": (snapshot: RoomSnapshot) => void
  "room:player-joined": (player: SocketPlayerSummary) => void
  "room:player-left": (player: { id: string; nickname: string }) => void
  "room:ready-updated": (players: Array<{ id: string; ready: boolean }>) => void
  "room:error": (error: EventFailure) => void
  "game:started": (view: PlayerGameView) => void
  "game:state": (view: PlayerGameView) => void
  "round:started": (view: PlayerGameView) => void
  "round:answer-phase": (phase: {
    phase: "protagonist_answer" | "players_answer" | "protagonist_selection"
    answerCount: number
    requiredAnswerCount: number
    deadlineAt: number | null
  }) => void
  "round:reveal": (view: PlayerGameView) => void
  "round:completed": (view: PlayerGameView) => void
  "score:updated": (
    players: Array<
      Pick<SocketPlayerSummary, "id" | "nickname" | "avatar" | "score">
    >
  ) => void
  "game:completed": (view: PlayerGameView) => void
  "game:summary": (summary: GameSummary) => void
  "game:replayed": (snapshot: RoomSnapshot) => void
}

export interface SocketData {
  playerId: string
  roomCode: string
}

export const SocketTicketEventSchema = z.object({
  playerId: z.string().uuid(),
  roomCode: roomCodeSchema,
})
