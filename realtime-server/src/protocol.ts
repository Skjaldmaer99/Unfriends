import { z } from "zod"

import type { PlayerGameView } from "./game/types.js"

const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/)

export const clientEventSchemas = {
  "room:leave": z.object({}).strict(),
  "room:start": z.object({}).strict(),
  "player:ready": z.object({ ready: z.boolean() }).strict(),
  "answer:submit": z
    .object({ content: z.string().trim().min(1).max(240) })
    .strict(),
  "answer:select": z.object({ answerId: z.string().min(1).max(128) }).strict(),
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
  settings: {
    roundsPerPlayer: number
    answerTimeLimitSeconds: number
    selectionTimeLimitSeconds: number
    enabledCategories: string[]
  }
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
  "player:ready": (
    payload: { ready: boolean },
    ack: EventAck<{ ready: boolean }>
  ) => void
  "answer:submit": (
    payload: { content: string },
    ack: EventAck<{ submitted: true }>
  ) => void
  "answer:select": (
    payload: { answerId: string },
    ack: EventAck<{ selected: true }>
  ) => void
  "round:next": (
    payload: Record<string, never>,
    ack: EventAck<{ finished: boolean }>
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
}

export interface SocketData {
  playerId: string
  roomCode: string
}

export const SocketTicketEventSchema = z.object({
  playerId: z.string().uuid(),
  roomCode: roomCodeSchema,
})
