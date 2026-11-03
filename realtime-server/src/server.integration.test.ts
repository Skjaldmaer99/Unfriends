import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { after, before, describe, it } from "node:test"
import { io as createSocketClient, type Socket } from "socket.io-client"
import { config } from "dotenv"
import { and, eq, inArray } from "drizzle-orm"
import { fileURLToPath } from "node:url"

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)) })

import {
  answers,
  players,
  rooms,
  rounds,
  votes,
  gameSessions,
} from "../../db/schema.js"
import { closeDatabase, getDatabase } from "../../lib/database.js"
import { createRoom, joinRoom, leaveRoom } from "../../lib/room-service.js"
import { hashPlayerSessionToken } from "../../lib/player-session.js"
import { createSocketTicket } from "./auth/socket-ticket.js"
import { createRealtimeServer } from "./server.js"
import type { PlayerGameView } from "./game/types.js"
import type {
  ClientToServerEvents,
  EventFailure,
  EventSuccess,
  GameSummary,
  ServerToClientEvents,
} from "./protocol.js"

process.env.SOCKET_TICKET_SECRET =
  "integration-test-secret-with-at-least-32-characters"

const allowedOrigin = "http://localhost:3000"
const integrationEnabled = Boolean(process.env.DATABASE_URL)
const { httpServer, io } = createRealtimeServer({
  allowedOrigins: [allowedOrigin],
})

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>
type EventPayload<Key extends keyof ServerToClientEvents> = Parameters<
  ServerToClientEvents[Key]
>[0]
interface TestPlayer {
  id: string
  nickname: string
  sessionTokenHash: string
}

const sockets = new Set<TestSocket>()
let roomId: string | null = null
let roomCode: string | null = null

function waitForEvent<Key extends keyof ServerToClientEvents>(
  socket: TestSocket,
  event: Key,
  predicate: (payload: EventPayload<Key>) => boolean = () => true,
  timeoutMs = 10_000
): Promise<EventPayload<Key>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener as never)
      reject(new Error(`Timed out waiting for ${String(event)}.`))
    }, timeoutMs)
    const listener = (payload: EventPayload<Key>) => {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(event, listener as never)
      resolve(payload)
    }
    socket.on(event, listener as never)
  })
}

function emitRoomStart(
  socket: TestSocket
): Promise<EventSuccess<{ started: true }> | EventFailure> {
  return new Promise((resolve) => socket.emit("room:start", {}, resolve))
}

function emitAnswer(
  socket: TestSocket,
  content: string
): Promise<EventSuccess<{ submitted: true }> | EventFailure> {
  return new Promise((resolve) =>
    socket.emit("answer:submit", { content }, resolve)
  )
}

function emitSelection(
  socket: TestSocket,
  answerIds: string[]
): Promise<EventSuccess<{ selected: true }> | EventFailure> {
  return new Promise((resolve) =>
    socket.emit("answer:select", { answerIds }, resolve)
  )
}

function emitRoundNext(
  socket: TestSocket
): Promise<EventSuccess<{ finished: boolean }> | EventFailure> {
  return new Promise((resolve) => socket.emit("round:next", {}, resolve))
}

function emitGameReplay(
  socket: TestSocket
): Promise<EventSuccess<{ replayed: true }> | EventFailure> {
  return new Promise((resolve) => socket.emit("game:replay", {}, resolve))
}

async function connectPlayer(
  player: TestPlayer,
  beforeConnect?: (socket: TestSocket) => void
): Promise<TestSocket> {
  assert.ok(roomCode)
  const ticket = await createSocketTicket({
    playerId: player.id,
    roomCode,
  })
  const socket: TestSocket = createSocketClient(
    `http://127.0.0.1:${getServerPort()}`,
    {
      auth: { ticket },
      autoConnect: false,
      extraHeaders: { origin: allowedOrigin },
      reconnection: false,
      timeout: 3_000,
      transports: ["websocket"],
    }
  )
  sockets.add(socket)
  const joined = waitForEvent(socket, "room:joined")
  beforeConnect?.(socket)
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve)
    socket.once("connect_error", reject)
    socket.connect()
  })
  await joined
  return socket
}

function getServerPort(): number {
  const address = httpServer.address()
  assert.ok(address && typeof address !== "string")
  return address.port
}

async function createTestRoom(): Promise<TestPlayer[]> {
  const database = getDatabase()
  const hostSessionTokenHash = hashPlayerSessionToken(
    randomBytes(32).toString("base64url")
  )
  const room = await createRoom(
    { nickname: "IntegrationHost", avatar: "sun" },
    hostSessionTokenHash
  )
  roomCode = room.code
  const roomRows = await database
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.code, room.code))
    .limit(1)
  roomId = roomRows[0]?.id ?? null
  assert.ok(roomId)

  const [host] = await database
    .select({ id: players.id, nickname: players.nickname })
    .from(players)
    .where(eq(players.roomId, roomId))
    .limit(1)
  assert.ok(host)

  const guestASessionTokenHash = hashPlayerSessionToken(
    randomBytes(32).toString("base64url")
  )
  const guestA = await joinRoom(
    { code: room.code, nickname: "IntegrationGuestA", avatar: "star" },
    guestASessionTokenHash
  )
  const guestBSessionTokenHash = hashPlayerSessionToken(
    randomBytes(32).toString("base64url")
  )
  const guestB = await joinRoom(
    { code: room.code, nickname: "IntegrationGuestB", avatar: "wave" },
    guestBSessionTokenHash
  )

  return [
    { ...host, sessionTokenHash: hostSessionTokenHash },
    {
      id: guestA.playerId,
      nickname: "IntegrationGuestA",
      sessionTokenHash: guestASessionTokenHash,
    },
    {
      id: guestB.playerId,
      nickname: "IntegrationGuestB",
      sessionTokenHash: guestBSessionTokenHash,
    },
  ]
}

async function cleanTestRoom(): Promise<void> {
  if (!roomId) return
  const database = getDatabase()
  const roomRounds = await database
    .select({ id: rounds.id })
    .from(rounds)
    .where(eq(rounds.roomId, roomId))
  const roundIds = roomRounds.map((round) => round.id)
  if (roundIds.length > 0) {
    await database.delete(votes).where(inArray(votes.roundId, roundIds))
    await database.delete(answers).where(inArray(answers.roundId, roundIds))
    await database.delete(rounds).where(inArray(rounds.id, roundIds))
  }
  await database.delete(gameSessions).where(eq(gameSessions.roomId, roomId))
  await database.delete(players).where(eq(players.roomId, roomId))
  await database.delete(rooms).where(eq(rooms.id, roomId))
  roomId = null
  roomCode = null
}

async function waitForRoomDisconnections(): Promise<void> {
  if (!roomId) return
  const database = getDatabase()
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const connectedPlayers = await database
      .select({ id: players.id })
      .from(players)
      .where(
        and(
          eq(players.roomId, roomId),
          eq(players.connectionStatus, "connected")
        )
      )
    if (connectedPlayers.length === 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error("Socket disconnection handlers did not finish in time.")
}

before(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject)
    httpServer.listen(0, "127.0.0.1", resolve)
  })
})

after(async () => {
  for (const socket of sockets) socket.disconnect()
  await new Promise<void>((resolve) => io.close(() => resolve()))
  if (integrationEnabled) await waitForRoomDisconnections()
  await cleanTestRoom()
  await closeDatabase()
})

describe(
  "authenticated multiplayer integration",
  { skip: !integrationEnabled },
  () => {
    it("plays a complete game, preserves answer privacy, and restores a reconnecting player", async () => {
      const testPlayers = await createTestRoom()
      const playerSockets = new Map<string, TestSocket>()
      for (const player of testPlayers) {
        playerSockets.set(player.id, await connectPlayer(player))
      }

      const host = testPlayers[0]
      const hostSocket = playerSockets.get(host.id)
      assert.ok(hostSocket)

      const unauthorizedStart = await emitRoomStart(
        playerSockets.get(testPlayers[1].id)!
      )
      assert.equal(unauthorizedStart.ok, false)
      if (!unauthorizedStart.ok) {
        assert.equal(unauthorizedStart.code, "HOST_REQUIRED")
      }

      const initialViews = [...playerSockets.values()].map((socket) =>
        waitForEvent(socket, "game:started")
      )
      const startResult = await emitRoomStart(hostSocket)
      assert.equal(startResult.ok, true)
      let started = (await Promise.all(initialViews)) as PlayerGameView[]
      assert.equal(started[0].totalRounds, testPlayers.length)

      for (
        let roundIndex = 0;
        roundIndex < testPlayers.length;
        roundIndex += 1
      ) {
        const roundView = started[0]
        const scoreBeforeByPlayerId = new Map(
          roundView.players.map((player) => [player.id, player.score])
        )
        const protagonistId = roundView.currentRound.protagonistId
        const protagonistSocket = playerSockets.get(protagonistId)
        assert.ok(protagonistSocket)

        const playerAnswerPhases = [...playerSockets.values()].map((socket) =>
          waitForEvent(
            socket,
            "round:answer-phase",
            (phase) => phase.phase === "players_answer"
          )
        )
        const originalResult = await emitAnswer(
          protagonistSocket,
          `Original answer for round ${roundIndex + 1}`
        )
        assert.equal(originalResult.ok, true)
        await Promise.all(playerAnswerPhases)

        const guestIds = testPlayers
          .map((player) => player.id)
          .filter((id) => id !== protagonistId)
        const firstGuestSocket = playerSockets.get(guestIds[0])
        assert.ok(firstGuestSocket)
        const firstGuess = await emitAnswer(
          firstGuestSocket,
          `Guess from ${testPlayers.find((player) => player.id === guestIds[0])?.nickname}`
        )
        assert.equal(firstGuess.ok, true)

        if (roundIndex === 0) {
          firstGuestSocket.disconnect()
          let restoredStateEvent: Promise<EventPayload<"game:state">> | null =
            null
          const reconnectedSocket = await connectPlayer(
            testPlayers.find((player) => player.id === guestIds[0])!,
            (socket) => {
              restoredStateEvent = waitForEvent(socket, "game:state")
            }
          )
          playerSockets.set(guestIds[0], reconnectedSocket)
          assert.ok(restoredStateEvent)
          const restoredState = (await restoredStateEvent) as PlayerGameView
          assert.equal(restoredState.currentRound.phase, "players_answer")
          assert.equal(restoredState.currentRound.hasSubmittedAnswer, true)
          assert.equal(restoredState.currentRound.answerCount, 1)
          assert.equal(restoredState.currentRound.originalAnswer, undefined)
        }

        const revealEvents = [...playerSockets.values()].map((socket) =>
          waitForEvent(socket, "round:reveal")
        )
        const remainingGuestSocket = playerSockets.get(guestIds[1])
        assert.ok(remainingGuestSocket)
        const secondGuess = await emitAnswer(
          remainingGuestSocket,
          `Guess from ${testPlayers.find((player) => player.id === guestIds[1])?.nickname}`
        )
        assert.equal(secondGuess.ok, true)

        const activePlayerIds = [...playerSockets.keys()]
        const reveals = (await Promise.all(revealEvents)) as PlayerGameView[]
        const protagonistView = reveals[activePlayerIds.indexOf(protagonistId)]
        assert.ok(protagonistView)
        assert.equal(
          protagonistView.currentRound.originalAnswer,
          `Original answer for round ${roundIndex + 1}`
        )
        assert.ok(
          reveals.every((view) =>
            view.currentRound.answers.every((answer) => !answer.authorId)
          )
        )
        assert.ok(
          reveals.every((view, index) =>
            activePlayerIds[index] === protagonistId
              ? view.currentRound.originalAnswer !== undefined
              : view.currentRound.originalAnswer === undefined
          )
        )

        const activeSockets = [...playerSockets.values()]
        const selectionPhases = activeSockets.map((socket) =>
          waitForEvent(
            socket,
            "round:answer-phase",
            (phase) => phase.phase === "protagonist_selection"
          )
        )
        await Promise.all(selectionPhases)

        const completedRounds = activeSockets.map((socket) =>
          waitForEvent(socket, "round:completed")
        )
        const selectedAnswerIds =
          roundIndex === testPlayers.length - 1
            ? protagonistView.currentRound.answers.map((answer) => answer.id)
            : [protagonistView.currentRound.answers[0].id]
        if (selectedAnswerIds.length > 1) {
          const unauthorizedSelection = await emitSelection(
            remainingGuestSocket,
            selectedAnswerIds
          )
          assert.equal(unauthorizedSelection.ok, false)
          if (!unauthorizedSelection.ok) {
            assert.equal(unauthorizedSelection.code, "NOT_PROTAGONIST")
          }
        }
        const selectionResult = await emitSelection(
          protagonistSocket,
          selectedAnswerIds
        )
        assert.equal(selectionResult.ok, true)
        const results = (await Promise.all(completedRounds)) as PlayerGameView[]
        assert.ok(
          results.every((view) => view.currentRound.phase === "round_result")
        )
        assert.equal(
          results[activePlayerIds.indexOf(protagonistId)].currentRound
            .originalAnswer,
          `Original answer for round ${roundIndex + 1}`
        )
        assert.ok(
          results.every((view) =>
            view.currentRound.answers.every(
              (answer) => answer.authorId !== undefined
            )
          )
        )
        assert.ok(
          results.some((view) =>
            view.players.some((player) => player.score >= 3)
          ),
          JSON.stringify(
            results.map((view) =>
              view.players.map(({ id, score }) => ({ id, score }))
            )
          )
        )
        if (selectedAnswerIds.length > 1) {
          const protagonistResult =
            results[activePlayerIds.indexOf(protagonistId)]
          assert.equal(
            protagonistResult.players.find(
              (player) => player.id === protagonistId
            )?.score,
            (scoreBeforeByPlayerId.get(protagonistId) ?? 0) + 1
          )
          for (const answer of protagonistResult.currentRound.answers) {
            if (!selectedAnswerIds.includes(answer.id)) continue
            const author = protagonistResult.players.find(
              (player) => player.id === answer.authorId
            )
            assert.equal(
              author?.score,
              (scoreBeforeByPlayerId.get(answer.authorId ?? "") ?? 0) + 3
            )
          }
        }

        if (roundIndex < testPlayers.length - 1) {
          const nextRounds = activeSockets.map((socket) =>
            waitForEvent(socket, "round:started")
          )
          const nextResult = await emitRoundNext(hostSocket)
          assert.equal(nextResult.ok, true)
          started = (await Promise.all(nextRounds)) as PlayerGameView[]
        } else {
          const completedGames = activeSockets.map((socket) =>
            waitForEvent(socket, "game:completed")
          )
          const summaries = activeSockets.map((socket) =>
            waitForEvent(socket, "game:summary")
          )
          const finalResult = await emitRoundNext(hostSocket)
          assert.deepEqual(finalResult, { ok: true, data: { finished: true } })
          const finalViews = (await Promise.all(
            completedGames
          )) as PlayerGameView[]
          const gameSummaries = (await Promise.all(summaries)) as GameSummary[]
          assert.ok(finalViews.every((view) => view.status === "finished"))
          assert.ok(
            gameSummaries.every((summary) => summary.roundsPlayed === 3)
          )
          assert.ok(
            gameSummaries.every((summary) => summary.answersSubmitted === 9)
          )
          assert.equal(finalViews[0].currentRound.selectedAnswerIds.length, 2)
          const persistedVotes = await getDatabase()
            .select({ selectedAnswerId: votes.selectedAnswerId })
            .from(votes)
            .innerJoin(rounds, eq(votes.roundId, rounds.id))
            .where(and(eq(rounds.roomId, roomId!), eq(rounds.roundNumber, 3)))
          assert.equal(persistedVotes.length, 2)
          assert.equal(
            new Set(persistedVotes.map((vote) => vote.selectedAnswerId)).size,
            2
          )
          const [persistedRoom] = await getDatabase()
            .select({ status: rooms.status })
            .from(rooms)
            .where(eq(rooms.id, roomId!))
            .limit(1)
          assert.equal(persistedRoom.status, "finished")
        }
      }

      const exitingPlayer = testPlayers[2]
      const exitResult = await leaveRoom(
        roomCode!,
        exitingPlayer.sessionTokenHash
      )
      assert.deepEqual(exitResult, { roomClosed: false })
      playerSockets.get(exitingPlayer.id)?.disconnect()
      playerSockets.delete(exitingPlayer.id)

      const currentSockets = [...playerSockets.values()]
      const replayUpdates = currentSockets.map((socket) =>
        waitForEvent(socket, "game:replayed")
      )
      const replayResult = await emitGameReplay(hostSocket)
      assert.deepEqual(replayResult, { ok: true, data: { replayed: true } })
      const lobbySnapshots = await Promise.all(replayUpdates)
      assert.ok(
        lobbySnapshots.every((snapshot) => snapshot.status === "waiting")
      )
      assert.ok(
        lobbySnapshots.every((snapshot) =>
          snapshot.players.every((player) => player.score === 0)
        )
      )

      const reconnectingPlayer = testPlayers[1]
      playerSockets.get(reconnectingPlayer.id)?.disconnect()
      hostSocket.disconnect()
      const hostJoinedEvents: Promise<EventPayload<"room:joined">>[] = []
      const guestJoinedEvents: Promise<EventPayload<"room:joined">>[] = []
      const [
        reconnectedHostSocket,
        reconnectedGuestSocket,
        reconnectedExitingPlayerSocket,
      ] = await Promise.all([
        connectPlayer(host, (socket) => {
          hostJoinedEvents.push(waitForEvent(socket, "room:joined"))
        }),
        connectPlayer(reconnectingPlayer, (socket) => {
          guestJoinedEvents.push(waitForEvent(socket, "room:joined"))
        }),
        connectPlayer(exitingPlayer),
      ])
      playerSockets.set(host.id, reconnectedHostSocket)
      playerSockets.set(reconnectingPlayer.id, reconnectedGuestSocket)
      playerSockets.set(exitingPlayer.id, reconnectedExitingPlayerSocket)
      const hostJoinedEvent = hostJoinedEvents[0]
      const guestJoinedEvent = guestJoinedEvents[0]
      assert.ok(hostJoinedEvent)
      assert.ok(guestJoinedEvent)
      const [reconnectedLobby, guestLobby] = await Promise.all([
        hostJoinedEvent,
        guestJoinedEvent,
      ])
      assert.equal(reconnectedLobby.status, "waiting")
      assert.equal(guestLobby.status, "waiting")
      assert.equal(
        reconnectedLobby.players.find((player) => player.id === host.id)
          ?.isHost,
        true
      )
      assert.equal(
        new Set(reconnectedLobby.players.map((player) => player.id)).size,
        testPlayers.length
      )

      const nextGameViews = [...playerSockets.values()].map((socket) =>
        waitForEvent(socket, "game:started")
      )
      const nextStart = await emitRoomStart(reconnectedHostSocket)
      assert.deepEqual(nextStart, { ok: true, data: { started: true } })
      const restartedViews = (await Promise.all(
        nextGameViews
      )) as PlayerGameView[]
      assert.ok(
        restartedViews.every(
          (view) =>
            view.currentRound.number === 1 &&
            view.currentRound.phase === "protagonist_answer"
        )
      )

      await new Promise<void>((resolve) => io.close(() => resolve()))
      const offlineLeaveResult = await leaveRoom(
        roomCode!,
        testPlayers[2].sessionTokenHash
      )
      assert.deepEqual(offlineLeaveResult, { roomClosed: false })
      const [leftPlayer] = await getDatabase()
        .select({ connectionStatus: players.connectionStatus })
        .from(players)
        .where(eq(players.id, testPlayers[2].id))
        .limit(1)
      assert.equal(leftPlayer.connectionStatus, "disconnected")
    })
  }
)
