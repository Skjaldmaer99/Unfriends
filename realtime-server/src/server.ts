import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from "node:http"
import { Server as SocketServer, type Socket } from "socket.io"
import { and, asc, eq, inArray } from "drizzle-orm"

import {
  answers,
  players,
  questions,
  rooms,
  rounds,
  votes,
} from "../../db/schema"
import { getDatabase } from "../../lib/database"
import { leaveRoomForPlayer, RoomServiceError } from "../../lib/room-service"
import {
  assertSocketTicketConfiguration,
  verifySocketTicket,
} from "./auth/socket-ticket.js"
import {
  advanceRound,
  beginSelection,
  createGame,
  expireCurrentPhase,
  GameRuleError,
  getPlayerGameView,
  selectWinningAnswer,
  submitPlayerAnswer,
  submitProtagonistAnswer,
} from "./game/game-engine.js"
import type { GameState } from "./game/types.js"
import { clientEventSchemas } from "./protocol.js"
import type {
  ClientToServerEvents,
  EventAck,
  EventFailure,
  EventSuccess,
  RoomSnapshot,
  ServerToClientEvents,
  SocketData,
} from "./protocol.js"

type InterServerEvents = Record<never, never>
type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

interface ActiveGame {
  roomId: string
  roomCode: string
  hostPlayerId: string
  state: GameState
  databaseRoundId: string
  answerIds: Map<string, string>
}

interface RealtimeServerOptions {
  allowedOrigins?: string[]
}

const activeGames = new Map<string, ActiveGame>()
const readyPlayers = new Map<string, Map<string, boolean>>()
const revealTimers = new Map<string, NodeJS.Timeout>()
const phaseTimers = new Map<string, NodeJS.Timeout>()

export function createRealtimeServer(options: RealtimeServerOptions = {}): {
  httpServer: HttpServer
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >
} {
  assertSocketTicketConfiguration()
  const allowedOrigins = options.allowedOrigins ?? readAllowedOrigins()
  const httpServer = createHttpServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ status: "ok" }))
      return
    }

    response.writeHead(404, { "content-type": "application/json" })
    response.end(JSON.stringify({ error: "Not found" }))
  })

  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ["websocket"],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    allowRequest: (request, callback) => {
      const origin = request.headers.origin
      callback(
        null,
        typeof origin === "string" && allowedOrigins.includes(origin)
      )
    },
  })

  io.use(async (socket, next) => {
    try {
      const ticket = socket.handshake.auth.ticket
      if (typeof ticket !== "string") {
        next(
          socketAuthError("MISSING_TICKET", "A realtime ticket is required.")
        )
        return
      }

      const claims = await verifySocketTicket(ticket)
      if (!claims) {
        next(
          socketAuthError(
            "INVALID_TICKET",
            "Realtime ticket is invalid or expired."
          )
        )
        return
      }

      const [membership] = await getDatabase()
        .select({ playerId: players.id, roomCode: rooms.code })
        .from(players)
        .innerJoin(rooms, eq(players.roomId, rooms.id))
        .where(
          and(eq(players.id, claims.playerId), eq(rooms.code, claims.roomCode))
        )
        .limit(1)

      if (!membership) {
        next(
          socketAuthError(
            "ROOM_MEMBERSHIP_REQUIRED",
            "Player is not in this room."
          )
        )
        return
      }

      socket.data.playerId = membership.playerId
      socket.data.roomCode = membership.roomCode
      next()
    } catch (error) {
      console.error("Socket authentication failed.", error)
      next(
        socketAuthError(
          "REALTIME_UNAVAILABLE",
          "Realtime service is unavailable."
        )
      )
    }
  })

  io.on("connection", (socket) => {
    void handleConnection(io, socket).catch((error: unknown) => {
      console.error("Socket connection setup failed.", error)
      socket.emit("room:error", {
        ok: false,
        code: "CONNECTION_SETUP_FAILED",
        error: "The room state could not be loaded.",
      })
      socket.disconnect(true)
    })
  })

  return { httpServer, io }
}

export function listenRealtimeServer(): void {
  const port = Number(process.env.PORT ?? process.env.SOCKET_PORT ?? 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a valid TCP port.")
  }

  const { httpServer } = createRealtimeServer()
  httpServer.listen(port, "0.0.0.0", () => {
    console.info(`Realtime server listening on port ${port}.`)
  })
}

function readAllowedOrigins(): string[] {
  const configuredOrigins = process.env.SOCKET_ALLOWED_ORIGINS
  if (!configuredOrigins) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SOCKET_ALLOWED_ORIGINS is required in production.")
    }
    return ["http://localhost:3000"]
  }

  const origins = configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (
    origins.length === 0 ||
    origins.some(
      (origin) => origin === "*" || new URL(origin).origin !== origin
    )
  ) {
    throw new Error(
      "SOCKET_ALLOWED_ORIGINS must contain exact origins, not wildcards."
    )
  }

  return origins
}

function socketAuthError(code: string, message: string): Error {
  const error = new Error(message) as Error & { data: { code: string } }
  error.data = { code }
  return error
}

async function handleConnection(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: RealtimeSocket
): Promise<void> {
  const { playerId, roomCode } = socket.data
  const database = getDatabase()
  const [priorPlayer] = await database
    .select({
      id: players.id,
      nickname: players.nickname,
      avatar: players.avatar,
      isHost: players.isHost,
      score: players.score,
      connectionStatus: players.connectionStatus,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)

  if (!priorPlayer) {
    socket.disconnect(true)
    return
  }

  const otherSockets = await io.in(roomCode).fetchSockets()
  const alreadyConnected = otherSockets.some(
    (candidate) => candidate.data.playerId === playerId
  )
  socket.join(roomCode)
  await database
    .update(players)
    .set({ connectionStatus: "connected" })
    .where(eq(players.id, playerId))

  const snapshot = await getRoomSnapshot(roomCode)
  socket.emit("room:joined", snapshot)
  if (!alreadyConnected) {
    io.to(roomCode)
      .except(socket.id)
      .emit("room:player-joined", {
        ...priorPlayer,
        connectionStatus: "connected",
      })
  }
  io.to(roomCode).emit("room:updated", snapshot)
  socket.emit(
    "room:ready-updated",
    snapshot.players.map((player) => ({
      id: player.id,
      ready: readyPlayers.get(roomCode)?.get(player.id) ?? false,
    }))
  )

  const activeGame = activeGames.get(roomCode)
  if (activeGame) {
    emitViewToSocket(socket, "game:state", activeGame.state)
  } else if (snapshot.status === "in_progress") {
    socket.emit("room:error", {
      ok: false,
      code: "GAME_STATE_UNAVAILABLE",
      error:
        "The active game state is unavailable. Recreate the room to continue.",
    })
  }

  registerRoomEvents(io, socket)
  registerGameEvents(io, socket)
  socket.on("disconnect", () => {
    void handleDisconnection(io, socket, priorPlayer.nickname).catch(
      (error: unknown) => {
        console.error("Socket disconnection handling failed.", error)
      }
    )
  })
}

function registerRoomEvents(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: RealtimeSocket
): void {
  socket.on("room:leave", (payload, ack) => {
    void runAction(socket, ack, async () => {
      clientEventSchemas["room:leave"].parse(payload)
      const player = await getPlayerSummary(socket.data.playerId)
      const result = await leaveRoomForPlayer(
        socket.data.roomCode,
        socket.data.playerId
      )
      socket.leave(socket.data.roomCode)
      readyPlayers.get(socket.data.roomCode)?.delete(socket.data.playerId)
      if (result.roomClosed) {
        readyPlayers.delete(socket.data.roomCode)
        activeGames.delete(socket.data.roomCode)
        clearPhaseTimer(socket.data.roomCode)
        clearRevealTimer(socket.data.roomCode)
      }
      io.to(socket.data.roomCode).emit("room:player-left", {
        id: socket.data.playerId,
        nickname: player.nickname,
      })
      await broadcastRoom(io, socket.data.roomCode)
      return result
    })
  })

  socket.on("room:start", (payload, ack) => {
    void runAction(socket, ack, async () => {
      clientEventSchemas["room:start"].parse(payload)
      const game = await startGame(socket.data.roomCode, socket.data.playerId)
      activeGames.set(socket.data.roomCode, game)
      readyPlayers.delete(socket.data.roomCode)
      schedulePhaseTimeout(io, game)
      await broadcastRoom(io, socket.data.roomCode)
      await emitGameViews(io, "game:started", game.state)
      return { started: true } as const
    })
  })

  socket.on("room:settings", (payload, ack) => {
    void runAction(socket, ack, async () => {
      const parsed = clientEventSchemas["room:settings"].parse(payload)
      const database = getDatabase()

      await database.transaction(async (transaction) => {
        const [room] = await transaction
          .select({ id: rooms.id, status: rooms.status })
          .from(rooms)
          .where(eq(rooms.code, socket.data.roomCode))
          .for("update")

        if (!room) {
          throw new RoomServiceError(
            "ROOM_NOT_FOUND",
            "Room code was not found."
          )
        }
        if (room.status !== "waiting") {
          throw new RoomServiceError(
            "ROOM_UNAVAILABLE",
            "Settings can only change before the game starts."
          )
        }

        const [host] = await transaction
          .select({ isHost: players.isHost })
          .from(players)
          .where(
            and(
              eq(players.id, socket.data.playerId),
              eq(players.roomId, room.id)
            )
          )
          .limit(1)

        if (!host) {
          throw new RoomServiceError(
            "UNAUTHORIZED",
            "Player session does not belong to this room."
          )
        }
        if (!host.isHost) {
          throw new RoomServiceError(
            "HOST_REQUIRED",
            "Only the host can change game settings."
          )
        }

        await transaction
          .update(rooms)
          .set({ settings: parsed.settings, updatedAt: new Date() })
          .where(eq(rooms.id, room.id))
      })

      await broadcastRoom(io, socket.data.roomCode)
      return { updated: true } as const
    })
  })

  socket.on("player:ready", (payload, ack) => {
    void runAction(socket, ack, async () => {
      const parsed = clientEventSchemas["player:ready"].parse(payload)
      const snapshot = await getRoomSnapshot(socket.data.roomCode)
      if (snapshot.status !== "waiting") {
        throw new RoomServiceError(
          "ROOM_UNAVAILABLE",
          "The game has already started."
        )
      }

      const roomReadyPlayers =
        readyPlayers.get(socket.data.roomCode) ?? new Map()
      roomReadyPlayers.set(socket.data.playerId, parsed.ready)
      readyPlayers.set(socket.data.roomCode, roomReadyPlayers)
      io.to(socket.data.roomCode).emit(
        "room:ready-updated",
        snapshot.players.map((player) => ({
          id: player.id,
          ready: roomReadyPlayers.get(player.id) ?? false,
        }))
      )
      return { ready: parsed.ready }
    })
  })
}

function registerGameEvents(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: RealtimeSocket
): void {
  socket.on("answer:submit", (payload, ack) => {
    void runAction(socket, ack, async () => {
      const parsed = clientEventSchemas["answer:submit"].parse(payload)
      const game = requireActiveGame(socket.data.roomCode)
      const now = Date.now()
      const nextState =
        game.state.currentRound.phase === "protagonist_answer"
          ? submitProtagonistAnswer(
              game.state,
              socket.data.playerId,
              parsed.content,
              now
            )
          : submitPlayerAnswer(
              game.state,
              socket.data.playerId,
              parsed.content,
              now
            )
      const isOriginal = game.state.currentRound.phase === "protagonist_answer"
      const roundStatus = nextState.currentRound.phase
      const [answer] = await getDatabase().transaction(async (transaction) => {
        const [insertedAnswer] = await transaction
          .insert(answers)
          .values({
            roundId: game.databaseRoundId,
            playerId: socket.data.playerId,
            content: parsed.content,
            isOriginalAnswer: isOriginal,
          })
          .returning({ id: answers.id })
        await transaction
          .update(rounds)
          .set({ status: roundStatus })
          .where(eq(rounds.id, game.databaseRoundId))
        return [insertedAnswer]
      })

      if (!isOriginal) {
        const answerKey = nextState.currentRound.answers.at(-1)?.id
        if (answerKey) {
          game.answerIds.set(answerKey, answer.id)
        }
      }
      if (nextState.currentRound.phase === "reveal") {
        game.state = nextState
        clearPhaseTimer(game.roomCode)
        await emitGameViews(io, "round:reveal", nextState)
        scheduleSelection(io, game)
      } else {
        game.state = nextState
        emitAnswerPhase(io, socket.data.roomCode, nextState)
        schedulePhaseTimeout(io, game)
      }

      return { submitted: true } as const
    })
  })

  socket.on("answer:select", (payload, ack) => {
    void runAction(socket, ack, async () => {
      const parsed = clientEventSchemas["answer:select"].parse(payload)
      const game = requireActiveGame(socket.data.roomCode)
      const databaseAnswerId = game.answerIds.get(parsed.answerId)
      if (!databaseAnswerId) {
        throw new GameRuleError(
          "ANSWER_NOT_FOUND",
          "The selected answer is invalid."
        )
      }
      const nextState = selectWinningAnswer(
        game.state,
        socket.data.playerId,
        parsed.answerId,
        Date.now()
      )
      const database = getDatabase()

      await database.transaction(async (transaction) => {
        await transaction.insert(votes).values({
          roundId: game.databaseRoundId,
          voterId: socket.data.playerId,
          selectedAnswerId: databaseAnswerId,
        })
        await Promise.all(
          nextState.players.map((player) =>
            transaction
              .update(players)
              .set({ score: player.score })
              .where(eq(players.id, player.id))
          )
        )
        await transaction
          .update(rounds)
          .set({ status: "round_result", completedAt: new Date() })
          .where(eq(rounds.id, game.databaseRoundId))
      })

      game.state = nextState
      clearPhaseTimer(game.roomCode)
      await emitGameViews(io, "round:completed", nextState)
      io.to(game.roomCode).emit(
        "score:updated",
        nextState.players.map(({ id, nickname, avatar, score }) => ({
          id,
          nickname,
          avatar: avatar ?? "sun",
          score,
        }))
      )
      return { selected: true } as const
    })
  })

  socket.on("round:next", (payload, ack) => {
    void runAction(socket, ack, async () => {
      clientEventSchemas["round:next"].parse(payload)
      const game = requireActiveGame(socket.data.roomCode)
      if (socket.data.playerId !== game.hostPlayerId) {
        throw new RoomServiceError(
          "HOST_REQUIRED",
          "Only the host can advance the round."
        )
      }

      const nextState = advanceRound(game.state)
      const database = getDatabase()
      if (nextState.status === "finished") {
        await database.transaction(async (transaction) => {
          await transaction
            .update(rounds)
            .set({ status: "finished", completedAt: new Date() })
            .where(eq(rounds.id, game.databaseRoundId))
          await transaction
            .update(rooms)
            .set({ status: "finished", updatedAt: new Date() })
            .where(eq(rooms.id, game.roomId))
        })
        game.state = nextState
        clearPhaseTimer(game.roomCode)
        await emitGameViews(io, "game:completed", nextState)
        await broadcastRoom(io, game.roomCode)
        return { finished: true }
      }

      const [databaseRound] = await database
        .insert(rounds)
        .values({
          roomId: game.roomId,
          questionId: nextState.currentRound.question.id,
          protagonistId: nextState.currentRound.protagonistId,
          roundNumber: nextState.currentRound.number,
          status: "protagonist_answer",
        })
        .returning({ id: rounds.id })

      game.state = nextState
      game.databaseRoundId = databaseRound.id
      game.answerIds.clear()
      await emitGameViews(io, "round:started", nextState)
      emitAnswerPhase(io, socket.data.roomCode, nextState)
      schedulePhaseTimeout(io, game)
      return { finished: false }
    })
  })
}

async function startGame(
  roomCode: string,
  hostPlayerId: string
): Promise<ActiveGame> {
  const database = getDatabase()

  return database.transaction(async (transaction) => {
    const [room] = await transaction
      .select()
      .from(rooms)
      .where(eq(rooms.code, roomCode))
      .for("update")

    if (!room) {
      throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
    }
    if (room.status !== "waiting") {
      throw new RoomServiceError(
        "ROOM_UNAVAILABLE",
        "The room has already started."
      )
    }

    const [host] = await transaction
      .select({ id: players.id, isHost: players.isHost })
      .from(players)
      .where(
        and(
          eq(players.roomId, room.id),
          eq(players.id, hostPlayerId),
          eq(players.connectionStatus, "connected")
        )
      )
      .limit(1)
    if (!host) {
      throw new RoomServiceError(
        "UNAUTHORIZED",
        "Host is not a connected room member."
      )
    }
    if (!host.isHost) {
      throw new RoomServiceError(
        "HOST_REQUIRED",
        "Only the host can start the game."
      )
    }

    const roomPlayers = await transaction
      .select({
        id: players.id,
        nickname: players.nickname,
        avatar: players.avatar,
      })
      .from(players)
      .where(
        and(
          eq(players.roomId, room.id),
          eq(players.connectionStatus, "connected")
        )
      )
      .orderBy(asc(players.joinedAt), asc(players.id))
    if (roomPlayers.length < 3) {
      throw new RoomServiceError(
        "TOO_FEW_PLAYERS",
        "At least three connected players are required to start."
      )
    }

    const questionBank = await transaction
      .select({
        id: questions.id,
        text: questions.text,
        category: questions.category,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .where(
        and(
          eq(questions.isActive, true),
          inArray(questions.category, room.settings.enabledCategories)
        )
      )

    const state = createGame({
      players: roomPlayers,
      questions: questionBank,
      settings: room.settings,
    })
    const [databaseRound] = await transaction
      .insert(rounds)
      .values({
        roomId: room.id,
        questionId: state.currentRound.question.id,
        protagonistId: state.currentRound.protagonistId,
        roundNumber: 1,
        status: "protagonist_answer",
      })
      .returning({ id: rounds.id })
    await transaction
      .update(rooms)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(rooms.id, room.id))

    return {
      roomId: room.id,
      roomCode,
      hostPlayerId,
      state,
      databaseRoundId: databaseRound.id,
      answerIds: new Map(),
    }
  })
}

function scheduleSelection(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  game: ActiveGame
): void {
  clearPhaseTimer(game.roomCode)
  const priorTimer = revealTimers.get(game.roomCode)
  if (priorTimer) {
    clearTimeout(priorTimer)
  }

  const timer = setTimeout(() => {
    revealTimers.delete(game.roomCode)
    const currentGame = activeGames.get(game.roomCode)
    if (!currentGame || currentGame.state.currentRound.phase !== "reveal") {
      return
    }

    try {
      const selectionState = beginSelection(currentGame.state)
      void getDatabase()
        .update(rounds)
        .set({ status: "protagonist_selection" })
        .where(eq(rounds.id, currentGame.databaseRoundId))
        .then(() => {
          currentGame.state = selectionState
          emitAnswerPhase(io, currentGame.roomCode, selectionState)
          schedulePhaseTimeout(io, currentGame)
        })
        .catch((error: unknown) => {
          console.error("Could not begin answer selection.", error)
        })
    } catch (error) {
      console.error("Could not transition to answer selection.", error)
    }
  }, 1_200)
  timer.unref()
  revealTimers.set(game.roomCode, timer)
}

function schedulePhaseTimeout(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  game: ActiveGame
): void {
  clearPhaseTimer(game.roomCode)
  const round = game.state.currentRound
  if (
    round.deadlineAt === null ||
    (round.phase !== "protagonist_answer" &&
      round.phase !== "players_answer" &&
      round.phase !== "protagonist_selection")
  ) {
    return
  }

  const roundId = round.id
  const phase = round.phase
  const timer = setTimeout(
    () => {
      phaseTimers.delete(game.roomCode)
      const currentGame = activeGames.get(game.roomCode)
      if (
        !currentGame ||
        currentGame.state.currentRound.id !== roundId ||
        currentGame.state.currentRound.phase !== phase
      ) {
        return
      }

      try {
        const expiredState = expireCurrentPhase(currentGame.state)
        void persistExpiredPhase(io, currentGame, expiredState).catch(
          (error: unknown) => {
            console.error("Could not persist expired game phase.", error)
          }
        )
      } catch (error) {
        console.error("Could not resolve expired game phase.", error)
      }
    },
    Math.max(0, round.deadlineAt - Date.now() + 1)
  )
  timer.unref()
  phaseTimers.set(game.roomCode, timer)
}

async function persistExpiredPhase(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  game: ActiveGame,
  expiredState: GameState
): Promise<void> {
  const database = getDatabase()
  if (expiredState.currentRound.phase === "reveal") {
    await database
      .update(rounds)
      .set({ status: "reveal" })
      .where(eq(rounds.id, game.databaseRoundId))
    game.state = expiredState
    await emitGameViews(io, "round:reveal", expiredState)
    scheduleSelection(io, game)
    return
  }

  await database.transaction(async (transaction) => {
    await Promise.all(
      expiredState.players.map((player) =>
        transaction
          .update(players)
          .set({ score: player.score })
          .where(eq(players.id, player.id))
      )
    )
    await transaction
      .update(rounds)
      .set({ status: "round_result", completedAt: new Date() })
      .where(eq(rounds.id, game.databaseRoundId))
  })

  game.state = expiredState
  clearPhaseTimer(game.roomCode)
  await emitGameViews(io, "round:completed", expiredState)
  io.to(game.roomCode).emit(
    "score:updated",
    expiredState.players.map(({ id, nickname, avatar, score }) => ({
      id,
      nickname,
      avatar: avatar ?? "sun",
      score,
    }))
  )
}

function clearPhaseTimer(roomCode: string): void {
  const timer = phaseTimers.get(roomCode)
  if (timer) {
    clearTimeout(timer)
    phaseTimers.delete(roomCode)
  }
}

function clearRevealTimer(roomCode: string): void {
  const timer = revealTimers.get(roomCode)
  if (timer) {
    clearTimeout(timer)
    revealTimers.delete(roomCode)
  }
}

function emitAnswerPhase(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  roomCode: string,
  state: GameState
): void {
  if (
    state.currentRound.phase !== "protagonist_answer" &&
    state.currentRound.phase !== "players_answer" &&
    state.currentRound.phase !== "protagonist_selection"
  ) {
    return
  }

  io.to(roomCode).emit("round:answer-phase", {
    phase: state.currentRound.phase,
    answerCount: state.currentRound.answers.length,
    requiredAnswerCount: state.players.length - 1,
    deadlineAt: state.currentRound.deadlineAt,
  })
}

function roomCodeForState(state: GameState): string {
  for (const [roomCode, game] of activeGames) {
    if (game.state === state) {
      return roomCode
    }
  }
  return ""
}

async function emitGameViews(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  event:
    | "game:started"
    | "game:state"
    | "round:started"
    | "round:reveal"
    | "round:completed"
    | "game:completed",
  state: GameState
): Promise<void> {
  const roomCode = roomCodeForState(state)
  const sockets = await io.in(roomCode).fetchSockets()
  for (const socket of sockets) {
    emitViewToSocket(socket, event, state)
  }
}

function emitViewToSocket(
  socket: Pick<RealtimeSocket, "data" | "emit">,
  event:
    | "game:started"
    | "game:state"
    | "round:started"
    | "round:reveal"
    | "round:completed"
    | "game:completed",
  state: GameState
): void {
  try {
    const view = getPlayerGameView(state, socket.data.playerId)
    switch (event) {
      case "game:started":
        socket.emit(event, view)
        break
      case "game:state":
        socket.emit(event, view)
        break
      case "round:started":
        socket.emit(event, view)
        break
      case "round:reveal":
        socket.emit(event, view)
        break
      case "round:completed":
        socket.emit(event, view)
        break
      case "game:completed":
        socket.emit(event, view)
        break
    }
  } catch {
    return
  }
}

async function getRoomSnapshot(roomCode: string): Promise<RoomSnapshot> {
  const database = getDatabase()
  const [room] = await database
    .select()
    .from(rooms)
    .where(eq(rooms.code, roomCode))
    .limit(1)
  if (!room) {
    throw new RoomServiceError("ROOM_NOT_FOUND", "Room code was not found.")
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
    players: roomPlayers,
  }
}

async function broadcastRoom(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  roomCode: string
): Promise<void> {
  try {
    io.to(roomCode).emit("room:updated", await getRoomSnapshot(roomCode))
  } catch (error) {
    if (!(
      error instanceof RoomServiceError && error.code === "ROOM_NOT_FOUND"
    )) {
      console.error("Could not broadcast room snapshot.", error)
    }
  }
}

async function getPlayerSummary(
  playerId: string
): Promise<{ nickname: string }> {
  const [player] = await getDatabase()
    .select({ nickname: players.nickname })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)
  if (!player) {
    throw new RoomServiceError(
      "UNAUTHORIZED",
      "Player is no longer in this room."
    )
  }
  return player
}

async function handleDisconnection(
  io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >,
  socket: RealtimeSocket,
  nickname: string
): Promise<void> {
  const { playerId, roomCode } = socket.data
  const remainingSockets = await io.in(roomCode).fetchSockets()
  if (
    remainingSockets.some((candidate) => candidate.data.playerId === playerId)
  ) {
    return
  }

  readyPlayers.get(roomCode)?.set(playerId, false)
  await getDatabase()
    .update(players)
    .set({ connectionStatus: "disconnected" })
    .where(eq(players.id, playerId))

  io.to(roomCode).emit("room:player-left", { id: playerId, nickname })
  await broadcastRoom(io, roomCode)
  const game = activeGames.get(roomCode)
  if (game) {
    await emitGameViews(io, "game:state", game.state)
  }
}

function requireActiveGame(roomCode: string): ActiveGame {
  const game = activeGames.get(roomCode)
  if (!game) {
    throw new RoomServiceError(
      "ROOM_UNAVAILABLE",
      "The game is not active on this server."
    )
  }
  return game
}

async function runAction<T>(
  socket: RealtimeSocket,
  ack: EventAck<T>,
  action: () => Promise<T>
): Promise<void> {
  try {
    const data = await action()
    const success: EventSuccess<T> = { ok: true, data }
    if (typeof ack === "function") {
      ack(success)
    }
  } catch (error) {
    const failure = toEventFailure(error)
    socket.emit("room:error", failure)
    if (typeof ack === "function") {
      ack(failure)
    }
  }
}

function toEventFailure(error: unknown): EventFailure {
  if (error instanceof GameRuleError) {
    return { ok: false, code: error.code, error: error.message }
  }
  if (error instanceof RoomServiceError) {
    return { ok: false, code: error.code, error: error.message }
  }
  if (error instanceof Error && error.name === "ZodError") {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      error: "Event payload is invalid.",
    }
  }
  console.error("Realtime event failed.", error)
  return {
    ok: false,
    code: "INTERNAL_ERROR",
    error: "The realtime event could not be completed.",
  }
}
