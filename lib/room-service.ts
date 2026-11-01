import { and, asc, count, eq, sql } from "drizzle-orm"

import { players, rooms } from "../db/schema.js"
import { getDatabase } from "./database.js"
import { generateRoomCode } from "./room-code.js"
import type { JoinRoomInput, PlayerIdentity } from "./room-input.js"

const MAX_CODE_ATTEMPTS = 8

export type RoomServiceErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_UNAVAILABLE"
  | "ROOM_FULL"
  | "NICKNAME_TAKEN"
  | "UNAUTHORIZED"
  | "HOST_REQUIRED"
  | "TOO_FEW_PLAYERS"
  | "ROOM_CODE_EXHAUSTED"

export class RoomServiceError extends Error {
  constructor(
    readonly code: RoomServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "RoomServiceError"
  }
}

export interface CreatedRoom {
  code: string
  playerId: string
}

export interface RoomLobbySnapshot {
  code: string
  status: "waiting" | "in_progress" | "finished"
  maxPlayers: number
  playerCount: number
  settings: typeof rooms.$inferSelect.settings
  selfPlayerId: string
  players: Array<{
    id: string
    nickname: string
    avatar: string
    isHost: boolean
    score: number
    connectionStatus: "connected" | "disconnected"
  }>
}

export async function createRoom(
  identity: PlayerIdentity,
  sessionTokenHash: string,
): Promise<CreatedRoom> {
  const database = getDatabase()

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode()

    try {
      return await database.transaction(async (transaction) => {
        const [room] = await transaction
          .insert(rooms)
          .values({ code, status: "waiting", maxPlayers: 8 })
          .returning({ id: rooms.id, code: rooms.code })

        const [player] = await transaction
          .insert(players)
          .values({
            roomId: room.id,
            sessionTokenHash,
            nickname: identity.nickname,
            avatar: identity.avatar,
            isHost: true,
          })
          .returning({ id: players.id })

        return { code: room.code, playerId: player.id }
      })
    } catch (error) {
      if (isUniqueConstraint(error, "rooms_code_unique")) {
        continue
      }
      if (isUniqueConstraint(error, "players_session_token_hash_unique")) {
        throw new RoomServiceError("UNAUTHORIZED", "Session token is already in use.")
      }
      throw error
    }
  }

  throw new RoomServiceError(
    "ROOM_CODE_EXHAUSTED",
    "A unique room code could not be generated. Try again.",
  )
}

export async function joinRoom(
  input: JoinRoomInput,
  sessionTokenHash: string,
): Promise<CreatedRoom> {
  const database = getDatabase()

  try {
    return await database.transaction(async (transaction) => {
      const [room] = await transaction
        .select()
        .from(rooms)
        .where(eq(rooms.code, input.code))
        .for("update")

      if (!room) {
        throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
      }
      if (room.status !== "waiting") {
        throw new RoomServiceError(
          "ROOM_UNAVAILABLE",
          "This room is no longer accepting players.",
        )
      }

      const [playerCount] = await transaction
        .select({ value: count() })
        .from(players)
        .where(eq(players.roomId, room.id))

      if (Number(playerCount.value) >= room.maxPlayers) {
        throw new RoomServiceError("ROOM_FULL", "This room has reached its player limit.")
      }

      const [existingNickname] = await transaction
        .select({ id: players.id })
        .from(players)
        .where(
          and(
            eq(players.roomId, room.id),
            sql`lower(${players.nickname}) = lower(${input.nickname})`,
          ),
        )
        .limit(1)

      if (existingNickname) {
        throw new RoomServiceError(
          "NICKNAME_TAKEN",
          "That nickname is already used in this room.",
        )
      }

      const [player] = await transaction
        .insert(players)
        .values({
          roomId: room.id,
          sessionTokenHash,
          nickname: input.nickname,
          avatar: input.avatar,
          isHost: false,
        })
        .returning({ id: players.id })

      return { code: room.code, playerId: player.id }
    })
  } catch (error) {
    if (isUniqueConstraint(error, "players_room_nickname_unique")) {
      throw new RoomServiceError(
        "NICKNAME_TAKEN",
        "That nickname is already used in this room.",
      )
    }
    if (isUniqueConstraint(error, "players_session_token_hash_unique")) {
      throw new RoomServiceError("UNAUTHORIZED", "Session token is already in use.")
    }
    throw error
  }
}

export async function getRoomLobby(
  code: string,
  sessionTokenHash: string,
): Promise<RoomLobbySnapshot> {
  const database = getDatabase()
  const [room] = await database
    .select()
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1)

  if (!room) {
    throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
  }

  const [self] = await database
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.roomId, room.id),
        eq(players.sessionTokenHash, sessionTokenHash),
      ),
    )
    .limit(1)

  if (!self) {
    throw new RoomServiceError("UNAUTHORIZED", "Join this room to view its lobby.")
  }

  const roomPlayers = await database
    .select({
      id: players.id,
      nickname: players.nickname,
      avatar: players.avatar,
      isHost: players.isHost,
      score: players.score,
      connectionStatus: players.connectionStatus,
    })
    .from(players)
    .where(eq(players.roomId, room.id))
    .orderBy(asc(players.joinedAt), asc(players.id))

  return {
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    playerCount: roomPlayers.length,
    settings: room.settings,
    selfPlayerId: self.id,
    players: roomPlayers,
  }
}

export async function leaveRoom(
  code: string,
  sessionTokenHash: string,
): Promise<{ roomClosed: boolean }> {
  const database = getDatabase()

  return database.transaction(async (transaction) => {
    const [room] = await transaction
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .for("update")

    if (!room) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
    }

    const [player] = await transaction
      .select()
      .from(players)
      .where(
        and(
          eq(players.roomId, room.id),
          eq(players.sessionTokenHash, sessionTokenHash),
        ),
      )
      .limit(1)

    if (!player) {
      throw new RoomServiceError("UNAUTHORIZED", "Player session does not belong to this room.")
    }

    if (room.status !== "waiting") {
      await transaction
        .update(players)
        .set({ connectionStatus: "disconnected" })
        .where(eq(players.id, player.id))
      return { roomClosed: false }
    }

    const remainingPlayers = await transaction
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.roomId, room.id), sql`${players.id} <> ${player.id}`))
      .orderBy(asc(players.joinedAt), asc(players.id))

    await transaction.delete(players).where(eq(players.id, player.id))

    if (player.isHost) {
      const successor = remainingPlayers[0]
      if (!successor) {
        await transaction.delete(rooms).where(eq(rooms.id, room.id))
        return { roomClosed: true }
      }

      await transaction
        .update(players)
        .set({ isHost: true })
        .where(eq(players.id, successor.id))
    }

    return { roomClosed: false }
  })
}

export async function startRoom(
  code: string,
  sessionTokenHash: string,
): Promise<void> {
  const database = getDatabase()

  await database.transaction(async (transaction) => {
    const [room] = await transaction
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .for("update")

    if (!room) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
    }
    if (room.status !== "waiting") {
      throw new RoomServiceError("ROOM_UNAVAILABLE", "This room has already started.")
    }

    const [host] = await transaction
      .select({ id: players.id, isHost: players.isHost })
      .from(players)
      .where(
        and(
          eq(players.roomId, room.id),
          eq(players.sessionTokenHash, sessionTokenHash),
        ),
      )
      .limit(1)

    if (!host) {
      throw new RoomServiceError("UNAUTHORIZED", "Player session does not belong to this room.")
    }
    if (!host.isHost) {
      throw new RoomServiceError("HOST_REQUIRED", "Only the host can start the game.")
    }

    const [connectedCount] = await transaction
      .select({ value: count() })
      .from(players)
      .where(
        and(
          eq(players.roomId, room.id),
          eq(players.connectionStatus, "connected"),
        ),
      )

    if (Number(connectedCount.value) < 3) {
      throw new RoomServiceError(
        "TOO_FEW_PLAYERS",
        "At least three connected players are required to start.",
      )
    }

    await transaction
      .update(rooms)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(rooms.id, room.id))
  })
}

function isUniqueConstraint(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const databaseError = error as { code?: unknown; constraint?: unknown }
  return databaseError.code === "23505" && databaseError.constraint === constraint
}