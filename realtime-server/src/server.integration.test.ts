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
    bluffQuestions,
    gamePrompts,
    players,
    rooms,
    rounds,
    secretCharacterRoles,
    secretCharacterScenarios,
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

function emitRoomSettings(
    socket: TestSocket,
    settings: import("./game/types.js").GameSettings
): Promise<EventSuccess<{ updated: true }> | EventFailure> {
    return new Promise((resolve) =>
        socket.emit("room:settings", { settings }, resolve)
    )
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
        it("stores categorized prompts, sourced facts, and structured secret roles", async () => {
            const database = getDatabase()
            const prompts = await database
                .select({ mode: gamePrompts.mode, category: gamePrompts.category })
                .from(gamePrompts)
                .where(
                    and(
                        eq(gamePrompts.isActive, true),
                        inArray(gamePrompts.mode, [
                            "absurd_situations",
                            "who_among_us",
                        ])
                    )
                )
            assert.ok(
                prompts.some((prompt) => prompt.mode === "absurd_situations")
            )
            assert.ok(prompts.some((prompt) => prompt.mode === "who_among_us"))
            assert.ok(
                prompts.some((prompt) => prompt.category === "travel")
            )

            const facts = await database
                .select({
                    text: bluffQuestions.text,
                    correctAnswer: bluffQuestions.correctAnswer,
                    explanation: bluffQuestions.explanation,
                    sourceUrl: bluffQuestions.sourceUrl,
                })
                .from(bluffQuestions)
                .where(eq(bluffQuestions.isActive, true))
            assert.ok(facts.length > 0)
            assert.ok(
                facts.every(
                    (fact) =>
                        fact.correctAnswer.length > 0 &&
                        fact.explanation.length > 0 &&
                        fact.sourceUrl.startsWith("https://")
                )
            )

            const scenarios = await database
                .select({
                    id: secretCharacterScenarios.id,
                    minPlayers: secretCharacterScenarios.minPlayers,
                })
                .from(secretCharacterScenarios)
                .where(eq(secretCharacterScenarios.isActive, true))
            assert.ok(scenarios.length > 0)
            for (const scenario of scenarios) {
                const roles = await database
                    .select({ position: secretCharacterRoles.position })
                    .from(secretCharacterRoles)
                    .where(eq(secretCharacterRoles.scenarioId, scenario.id))
                assert.ok(roles.length >= scenario.minPlayers)
                assert.equal(
                    new Set(roles.map((role) => role.position)).size,
                    roles.length
                )
            }
        })

        it("plays all Bluff rounds without revealing the fact before vote resolution", async (testContext) => {
            const scopedSockets = new Set<TestSocket>()
            testContext.after(async () => {
                for (const socket of scopedSockets) socket.disconnect()
                await waitForRoomDisconnections()
                await cleanTestRoom()
            })

            const testPlayers = await createTestRoom()
            const playerSockets = new Map<string, TestSocket>()
            for (const player of testPlayers) {
                const socket = await connectPlayer(player)
                scopedSockets.add(socket)
                playerSockets.set(player.id, socket)
            }
            const hostSocket = playerSockets.get(testPlayers[0].id)
            assert.ok(hostSocket)

            const [roomSettings] = await getDatabase()
                .select({ settings: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            assert.equal(
                (
                    await emitRoomSettings(hostSocket, {
                        ...roomSettings.settings,
                        mode: "bluff",
                        roundsPerPlayer: 1,
                        enabledCategories: ["general_knowledge"],
                    })
                ).ok,
                true
            )

            const startEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:started")
            )
            assert.equal((await emitRoomStart(hostSocket)).ok, true)
            let currentViews = (await Promise.all(startEvents)) as PlayerGameView[]
            assert.ok(
                currentViews.every(
                    (view) =>
                        view.mode === "bluff" &&
                        view.currentRound.phase === "players_answer" &&
                        view.currentRound.requiredAnswerCount === testPlayers.length
                )
            )

            const expectedScores = new Map(testPlayers.map((player) => [player.id, 0]))
            for (let roundIndex = 0; roundIndex < currentViews[0].totalRounds; roundIndex += 1) {
                const [persistedRound] = await getDatabase()
                    .select({ bluffQuestionId: rounds.bluffQuestionId })
                    .from(rounds)
                    .where(and(eq(rounds.roomId, roomId!), eq(rounds.roundNumber, roundIndex + 1)))
                    .limit(1)
                assert.ok(persistedRound.bluffQuestionId)
                const [factual] = await getDatabase()
                    .select({
                        correctAnswer: bluffQuestions.correctAnswer,
                        explanation: bluffQuestions.explanation,
                        sourceUrl: bluffQuestions.sourceUrl,
                    })
                    .from(bluffQuestions)
                    .where(eq(bluffQuestions.id, persistedRound.bluffQuestionId))
                    .limit(1)

                const revealEvents = [...playerSockets.values()].map((socket) =>
                    waitForEvent(socket, "round:reveal")
                )
                for (const [index, player] of testPlayers.entries()) {
                    assert.equal(
                        (
                            await emitAnswer(
                                playerSockets.get(player.id)!,
                                `Bluff ${roundIndex + 1}-${index + 1}`
                            )
                        ).ok,
                        true
                    )
                }
                const revealViews = (await Promise.all(revealEvents)) as PlayerGameView[]
                assert.ok(
                    revealViews.every(
                        (view) =>
                            view.currentRound.answers.length === testPlayers.length &&
                            view.currentRound.answers.every(
                                (answer) =>
                                    answer.authorId === undefined &&
                                    answer.isCorrectAnswer === undefined &&
                                    answer.content !== factual.correctAnswer
                            ) &&
                            view.currentRound.bluffExplanation === undefined &&
                            view.currentRound.bluffSourceUrl === undefined
                    )
                )

                const selectionEvents = [...playerSockets.values()].map((socket) =>
                    waitForEvent(
                        socket,
                        "round:answer-phase",
                        (phase) => phase.phase === "protagonist_selection"
                    )
                )
                const selectionStateEvents = [...playerSockets.values()].map((socket) =>
                    waitForEvent(socket, "game:state")
                )
                await Promise.all(selectionEvents)
                const selectionViews = (await Promise.all(selectionStateEvents)) as PlayerGameView[]
                const selectedView = selectionViews[0]
                const optionByPlayerId = new Map(
                    testPlayers.map((player, index) => {
                        const answer = selectedView.currentRound.answers.find(
                            (candidate) => candidate.content === `Bluff ${roundIndex + 1}-${index + 1}`
                        )
                        assert.ok(answer)
                        return [player.id, answer.id] as const
                    })
                )
                const correctOption = selectedView.currentRound.answers.find(
                    (answer) => answer.content === factual.correctAnswer
                )
                assert.ok(correctOption)
                assert.ok(selectedView.currentRound.answers.every((answer) => answer.isCorrectAnswer === undefined))

                const firstViewsPromise = [...playerSockets.values()].map((socket) =>
                    waitForEvent(socket, "game:state")
                )
                const firstProgressPromise = [...playerSockets.values()].map((socket) =>
                    waitForEvent(socket, "round:vote-phase")
                )
                assert.equal(
                    (await emitSelection(playerSockets.get(testPlayers[0].id)!, [correctOption.id])).ok,
                    true
                )
                const firstViews = (await Promise.all(firstViewsPromise)) as PlayerGameView[]
                const firstProgress = await Promise.all(firstProgressPromise)
                assert.ok(firstProgress.every((progress) => progress.voteCount === 1))
                assert.ok(
                    firstViews.every(
                        (view) =>
                            view.currentRound.phase === "protagonist_selection" &&
                            !("votes" in view.currentRound) &&
                            view.currentRound.answers.every((answer) => answer.isCorrectAnswer === undefined) &&
                            view.currentRound.bluffExplanation === undefined &&
                            view.currentRound.bluffSourceUrl === undefined
                    )
                )

                const duplicate = await emitSelection(
                    playerSockets.get(testPlayers[0].id)!,
                    [correctOption.id]
                )
                assert.equal(duplicate.ok, false)
                if (!duplicate.ok) assert.equal(duplicate.code, "VOTE_ALREADY_SUBMITTED")
                const ownBluffVote = await emitSelection(
                    playerSockets.get(testPlayers[1].id)!,
                    [optionByPlayerId.get(testPlayers[1].id)!]
                )
                assert.equal(ownBluffVote.ok, false)
                if (!ownBluffVote.ok) assert.equal(ownBluffVote.code, "PROTAGONIST_CANNOT_GUESS")

                const completedEvents = [...playerSockets.values()].map((socket) =>
                    waitForEvent(socket, "round:completed")
                )
                assert.equal(
                    (await emitSelection(
                        playerSockets.get(testPlayers[1].id)!,
                        [optionByPlayerId.get(testPlayers[0].id)!]
                    )).ok,
                    true
                )
                assert.equal(
                    (await emitSelection(playerSockets.get(testPlayers[2].id)!, [correctOption.id])).ok,
                    true
                )
                const results = (await Promise.all(completedEvents)) as PlayerGameView[]
                assert.ok(
                    results.every((view) => {
                        const truth = view.currentRound.answers.find(
                            (answer) => answer.isCorrectAnswer
                        )
                        return (
                            view.currentRound.phase === "round_result" &&
                            truth?.content === factual.correctAnswer &&
                            truth.authorId === undefined &&
                            truth.voteCount === 2 &&
                            view.currentRound.bluffExplanation === factual.explanation &&
                            view.currentRound.bluffSourceUrl === factual.sourceUrl
                        )
                    })
                )
                expectedScores.set(testPlayers[0].id, (expectedScores.get(testPlayers[0].id) ?? 0) + 3)
                expectedScores.set(testPlayers[1].id, expectedScores.get(testPlayers[1].id) ?? 0)
                expectedScores.set(testPlayers[2].id, (expectedScores.get(testPlayers[2].id) ?? 0) + 2)
                assert.deepEqual(
                    results[0].players.map(({ id, score }) => [id, score]),
                    testPlayers.map((player) => [player.id, expectedScores.get(player.id)])
                )

                if (roundIndex < currentViews[0].totalRounds - 1) {
                    const nextRoundEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "round:started")
                    )
                    assert.equal((await emitRoundNext(hostSocket)).ok, true)
                    currentViews = (await Promise.all(nextRoundEvents)) as PlayerGameView[]
                } else {
                    const completedGames = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:completed")
                    )
                    const summaries = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:summary")
                    )
                    assert.deepEqual(
                        await emitRoundNext(hostSocket),
                        { ok: true, data: { finished: true } }
                    )
                    const finalViews = (await Promise.all(completedGames)) as PlayerGameView[]
                    const finalSummaries = await Promise.all(summaries)
                    assert.ok(finalViews.every((view) => view.status === "finished"))
                    assert.ok(finalSummaries.every((summary) => summary.correctVotes === 6 && summary.votesCast === 9))

                    const replayEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:replayed")
                    )
                    assert.deepEqual(
                        await emitGameReplay(hostSocket),
                        { ok: true, data: { replayed: true } }
                    )
                    const replayedRooms = await Promise.all(replayEvents)
                    assert.ok(
                        replayedRooms.every(
                            (snapshot) =>
                                snapshot.status === "waiting" &&
                                snapshot.settings.mode === "bluff" &&
                                snapshot.players.every((player) => player.score === 0)
                        )
                    )

                    const restartedGames = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:started")
                    )
                    assert.deepEqual(
                        await emitRoomStart(hostSocket),
                        { ok: true, data: { started: true } }
                    )
                    const restartedViews = (await Promise.all(restartedGames)) as PlayerGameView[]
                    assert.ok(
                        restartedViews.every(
                            (view) =>
                                view.mode === "bluff" &&
                                view.currentRound.phase === "players_answer" &&
                                view.players.every((player) => player.score === 0)
                        )
                    )
                }
            }

            const storedAnswers = await getDatabase()
                .select({ playerId: answers.playerId, isOriginalAnswer: answers.isOriginalAnswer })
                .from(answers)
                .innerJoin(rounds, eq(answers.roundId, rounds.id))
                .where(eq(rounds.roomId, roomId!))
            assert.equal(storedAnswers.length, testPlayers.length * 4)
            assert.equal(
                storedAnswers.filter((answer) => answer.playerId === null && answer.isOriginalAnswer).length,
                testPlayers.length
            )
            assert.equal(
                storedAnswers.filter((answer) => answer.playerId !== null && !answer.isOriginalAnswer).length,
                testPlayers.length * testPlayers.length
            )
        })

        it("plays all Who Among Us rounds with secret votes and optional scoring", async (testContext) => {
            const scopedSockets = new Set<TestSocket>()
            testContext.after(async () => {
                for (const socket of scopedSockets) socket.disconnect()
                await waitForRoomDisconnections()
                await cleanTestRoom()
            })

            const testPlayers = await createTestRoom()
            const playerSockets = new Map<string, TestSocket>()
            for (const player of testPlayers) {
                const socket = await connectPlayer(player)
                scopedSockets.add(socket)
                playerSockets.set(player.id, socket)
            }
            const hostSocket = playerSockets.get(testPlayers[0].id)
            assert.ok(hostSocket)

            const [roomSettings] = await getDatabase()
                .select({ settings: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            assert.equal(
                (
                    await emitRoomSettings(hostSocket, {
                        ...roomSettings.settings,
                        mode: "who_among_us",
                        scoringEnabled: true,
                        roundsPerPlayer: 1,
                        enabledCategories: ["travel"],
                    })
                ).ok,
                true
            )

            const startEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:started")
            )
            assert.equal((await emitRoomStart(hostSocket)).ok, true)
            let currentViews = (await Promise.all(startEvents)) as PlayerGameView[]
            assert.ok(
                currentViews.every(
                    (view) =>
                        view.mode === "who_among_us" &&
                        view.currentRound.phase === "protagonist_selection" &&
                        view.currentRound.answers.length === testPlayers.length &&
                        view.currentRound.requiredVoteCount === testPlayers.length
                )
            )

            for (let roundIndex = 0; roundIndex < currentViews[0].totalRounds; roundIndex += 1) {
                const initialView = currentViews[0]
                const answerIdByPlayerId = new Map(
                    initialView.currentRound.answers.map((answer) => {
                        const player = testPlayers.find(
                            (candidate) => candidate.nickname === answer.content
                        )
                        assert.ok(player)
                        return [player.id, answer.id] as const
                    })
                )
                assert.equal(answerIdByPlayerId.size, testPlayers.length)
                assert.ok(
                    currentViews.every((view) =>
                        view.currentRound.answers.every(
                            (answer) => answer.authorId === undefined
                        )
                    )
                )

                const firstPlayer = testPlayers[0]
                const selfVote = await emitSelection(
                    playerSockets.get(firstPlayer.id)!,
                    [answerIdByPlayerId.get(firstPlayer.id)!]
                )
                assert.equal(selfVote.ok, false)
                if (!selfVote.ok) assert.equal(selfVote.code, "PROTAGONIST_CANNOT_GUESS")

                const scoresBefore = new Map(
                    initialView.players.map((player) => [player.id, player.score])
                )
                for (let voterIndex = 0; voterIndex < testPlayers.length; voterIndex += 1) {
                    const voter = testPlayers[voterIndex]
                    const target = testPlayers[(voterIndex + 1) % testPlayers.length]
                    const targetAnswerId = answerIdByPlayerId.get(target.id)
                    assert.ok(targetAnswerId)

                    if (voterIndex < testPlayers.length - 1) {
                        const stateEvents = [...playerSockets.values()].map((socket) =>
                            waitForEvent(socket, "game:state")
                        )
                        const progressEvents = [...playerSockets.values()].map((socket) =>
                            waitForEvent(socket, "round:vote-phase")
                        )
                        const voteResult = await emitSelection(
                            playerSockets.get(voter.id)!,
                            [targetAnswerId]
                        )
                        assert.equal(voteResult.ok, true)
                        const views = (await Promise.all(stateEvents)) as PlayerGameView[]
                        const progress = await Promise.all(progressEvents)
                        assert.ok(progress.every((item) => item.requiredVoteCount === testPlayers.length))
                        assert.ok(
                            views.every(
                                (view) =>
                                    view.currentRound.phase === "protagonist_selection" &&
                                    !("votes" in view.currentRound) &&
                                    view.currentRound.answers.every(
                                        (answer) => answer.voteCount === undefined
                                    )
                            )
                        )
                        assert.equal(views[voterIndex].currentRound.hasSubmittedVote, true)
                    } else {
                        const resultEvents = [...playerSockets.values()].map((socket) =>
                            waitForEvent(socket, "round:completed")
                        )
                        const voteResult = await emitSelection(
                            playerSockets.get(voter.id)!,
                            [targetAnswerId]
                        )
                        assert.equal(voteResult.ok, true)
                        const results = (await Promise.all(resultEvents)) as PlayerGameView[]
                        assert.ok(
                            results.every(
                                (view) =>
                                    view.currentRound.phase === "round_result" &&
                                    view.currentRound.selectedAnswerIds.length === testPlayers.length &&
                                    view.currentRound.answers.every(
                                        (answer) => answer.authorId !== undefined
                                    )
                            )
                        )
                        assert.deepEqual(
                            results[0].players.map(({ id, score }) => [id, score]),
                            testPlayers.map((player) => [
                                player.id,
                                (scoresBefore.get(player.id) ?? 0) + 3,
                            ])
                        )
                    }
                }

                if (roundIndex < initialView.totalRounds - 1) {
                    const nextRoundEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "round:started")
                    )
                    assert.equal((await emitRoundNext(hostSocket)).ok, true)
                    currentViews = (await Promise.all(nextRoundEvents)) as PlayerGameView[]
                } else {
                    const completionEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:completed")
                    )
                    const summaries = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:summary")
                    )
                    assert.deepEqual(
                        await emitRoundNext(hostSocket),
                        { ok: true, data: { finished: true } }
                    )
                    const finishedViews = (await Promise.all(completionEvents)) as PlayerGameView[]
                    const finalSummaries = await Promise.all(summaries)
                    assert.ok(finishedViews.every((view) => view.status === "finished"))
                    assert.ok(
                        finalSummaries.every(
                            (summary) =>
                                summary.roundsPlayed === testPlayers.length &&
                                summary.answersSubmitted === 0 &&
                                summary.votesCast === testPlayers.length * testPlayers.length &&
                                summary.winningVotes === testPlayers.length * testPlayers.length
                        )
                    )
                    const persistedCandidates = await getDatabase()
                        .select({ playerId: answers.playerId, isOriginalAnswer: answers.isOriginalAnswer })
                        .from(answers)
                        .innerJoin(rounds, eq(answers.roundId, rounds.id))
                        .where(eq(rounds.roomId, roomId!))
                    const persistedVotes = await getDatabase()
                        .select({ id: votes.id })
                        .from(votes)
                        .innerJoin(rounds, eq(votes.roundId, rounds.id))
                        .where(eq(rounds.roomId, roomId!))
                    assert.equal(persistedCandidates.length, testPlayers.length * testPlayers.length)
                    assert.ok(
                        persistedCandidates.every(
                            (answer) => answer.playerId !== null && !answer.isOriginalAnswer
                        )
                    )
                    assert.equal(persistedVotes.length, testPlayers.length * testPlayers.length)

                    const replayEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:replayed")
                    )
                    assert.equal((await emitGameReplay(hostSocket)).ok, true)
                    const replayed = await Promise.all(replayEvents)
                    assert.ok(
                        replayed.every(
                            (snapshot) =>
                                snapshot.settings.mode === "who_among_us" &&
                                snapshot.players.every((player) => player.score === 0)
                        )
                    )
                    const disableScoring = await emitRoomSettings(hostSocket, {
                        ...roomSettings.settings,
                        mode: "who_among_us",
                        scoringEnabled: false,
                        roundsPerPlayer: 1,
                        enabledCategories: ["travel"],
                    })
                    assert.equal(disableScoring.ok, true)
                    const restartedEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "game:started")
                    )
                    assert.equal((await emitRoomStart(hostSocket)).ok, true)
                    const restarted = (await Promise.all(restartedEvents)) as PlayerGameView[]
                    assert.ok(
                        restarted.every(
                            (view) =>
                                view.mode === "who_among_us" &&
                                view.currentRound.phase === "protagonist_selection" &&
                                view.players.every((player) => player.score === 0)
                        )
                    )
                    const restartedCandidates = new Map(
                        restarted[0].currentRound.answers.map((answer) => [
                            answer.content,
                            answer.id,
                        ])
                    )
                    const noScoreResultEvents = [...playerSockets.values()].map((socket) =>
                        waitForEvent(socket, "round:completed")
                    )
                    for (let voterIndex = 0; voterIndex < testPlayers.length; voterIndex += 1) {
                        const voter = testPlayers[voterIndex]
                        const target = testPlayers[(voterIndex + 1) % testPlayers.length]
                        const targetAnswerId = restartedCandidates.get(target.nickname)
                        assert.ok(targetAnswerId)
                        assert.equal(
                            (await emitSelection(playerSockets.get(voter.id)!, [targetAnswerId])).ok,
                            true
                        )
                    }
                    const noScoreResults = (await Promise.all(noScoreResultEvents)) as PlayerGameView[]
                    assert.ok(
                        noScoreResults.every(
                            (view) =>
                                view.currentRound.phase === "round_result" &&
                                view.players.every((player) => player.score === 0)
                        )
                    )
                }
            }

            const disableScoring = await emitRoomSettings(hostSocket, {
                ...roomSettings.settings,
                mode: "who_among_us",
                scoringEnabled: false,
                roundsPerPlayer: 1,
                enabledCategories: ["travel"],
            })
            assert.equal(disableScoring.ok, false)
            if (!disableScoring.ok) assert.equal(disableScoring.code, "ROOM_UNAVAILABLE")
        })

        it("plays an anonymous absurd-situations vote and resolves a three-way tie", async (testContext) => {
            const scopedSockets = new Set<TestSocket>()
            testContext.after(async () => {
                for (const socket of scopedSockets) socket.disconnect()
                await waitForRoomDisconnections()
                await cleanTestRoom()
            })

            const testPlayers = await createTestRoom()
            const playerSockets = new Map<string, TestSocket>()
            for (const player of testPlayers) {
                const socket = await connectPlayer(player)
                scopedSockets.add(socket)
                playerSockets.set(player.id, socket)
            }
            const hostSocket = playerSockets.get(testPlayers[0].id)
            assert.ok(hostSocket)

            const [roomSettings] = await getDatabase()
                .select({ settings: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            const modeUpdates = [...playerSockets.values()].map((socket) =>
                waitForEvent(
                    socket,
                    "room:updated",
                    (snapshot) => snapshot.settings.mode === "absurd_situations"
                )
            )
            const settingsResult = await emitRoomSettings(hostSocket, {
                ...roomSettings.settings,
                mode: "absurd_situations",
                enabledCategories: ["friendship"],
            })
            assert.deepEqual(settingsResult, { ok: true, data: { updated: true } })
            const updatedRooms = await Promise.all(modeUpdates)
            assert.ok(
                updatedRooms.every(
                    (snapshot) => snapshot.settings.mode === "absurd_situations"
                )
            )
            assert.ok(
                updatedRooms.every((snapshot) =>
                    snapshot.settings.enabledCategories.every((category) =>
                        [
                            "absurd",
                            "everyday_life",
                            "fantasy",
                            "impossible_situations",
                        ].includes(category)
                    )
                )
            )

            const startEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:started")
            )
            const startResult = await emitRoomStart(hostSocket)
            assert.deepEqual(startResult, { ok: true, data: { started: true } })
            const startedViews = (await Promise.all(startEvents)) as PlayerGameView[]
            assert.ok(
                startedViews.every(
                    (view) =>
                        view.mode === "absurd_situations" &&
                        view.currentRound.phase === "players_answer" &&
                        view.currentRound.requiredAnswerCount === testPlayers.length
                )
            )
            assert.match(startedViews[0].currentRound.question.text, /[?.!]/)

            const revealEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "round:reveal")
            )
            for (const [index, player] of testPlayers.entries()) {
                const answerResult = await emitAnswer(
                    playerSockets.get(player.id)!,
                    `Risposta assurda ${index + 1}`
                )
                assert.deepEqual(answerResult, { ok: true, data: { submitted: true } })
            }
            const revealedViews = (await Promise.all(revealEvents)) as PlayerGameView[]
            assert.ok(
                revealedViews.every(
                    (view) =>
                        view.currentRound.answers.length === testPlayers.length &&
                        view.currentRound.answers.every(
                            (answer) => answer.authorId === undefined
                        ) &&
                        view.currentRound.originalAnswer === undefined
                )
            )

            const selectionEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(
                    socket,
                    "round:answer-phase",
                    (phase) => phase.phase === "protagonist_selection"
                )
            )
            await Promise.all(selectionEvents)
            const roundView = revealedViews[0]
            const answerByPlayerId = new Map(
                roundView.currentRound.answers.map((answer) => [
                    answer.content,
                    answer.id,
                ])
            )
            const ownAnswerId = answerByPlayerId.get("Risposta assurda 1")
            const otherAnswerId = answerByPlayerId.get("Risposta assurda 2")
            assert.ok(ownAnswerId)
            assert.ok(otherAnswerId)

            const firstVoter = testPlayers[0]
            const firstVoterSocket = playerSockets.get(firstVoter.id)!
            const selfVote = await emitSelection(firstVoterSocket, [ownAnswerId])
            assert.equal(selfVote.ok, false)
            if (!selfVote.ok) assert.equal(selfVote.code, "PROTAGONIST_CANNOT_GUESS")

            const votePhaseEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "round:vote-phase")
            )
            const privateStateEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:state")
            )
            const firstVote = await emitSelection(firstVoterSocket, [otherAnswerId])
            assert.deepEqual(firstVote, { ok: true, data: { selected: true } })
            const votePhases = await Promise.all(votePhaseEvents)
            const privateViews = (await Promise.all(privateStateEvents)) as PlayerGameView[]
            assert.ok(
                votePhases.every(
                    (phase) =>
                        phase.voteCount === 1 &&
                        phase.requiredVoteCount === testPlayers.length
                )
            )
            assert.ok(
                privateViews.every(
                    (view) =>
                        view.currentRound.phase === "protagonist_selection" &&
                        view.currentRound.voteCount === 1 &&
                        !("votes" in view.currentRound)
                )
            )
            assert.equal(privateViews[0].currentRound.hasSubmittedVote, true)
            assert.equal(privateViews[1].currentRound.hasSubmittedVote, false)
            const [intermediateRound] = await getDatabase()
                .select({ status: rounds.status })
                .from(rounds)
                .where(eq(rounds.roomId, roomId!))
                .limit(1)
            assert.equal(intermediateRound.status, "protagonist_selection")
            const intermediateVotes = await getDatabase()
                .select({ id: votes.id })
                .from(votes)
                .innerJoin(rounds, eq(votes.roundId, rounds.id))
                .where(eq(rounds.roomId, roomId!))
            assert.equal(intermediateVotes.length, 1)

            const duplicateVote = await emitSelection(firstVoterSocket, [otherAnswerId])
            assert.equal(duplicateVote.ok, false)
            if (!duplicateVote.ok) {
                assert.equal(duplicateVote.code, "VOTE_ALREADY_SUBMITTED")
            }

            const completedEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "round:completed")
            )
            const circularVotes = [
                [testPlayers[1], "Risposta assurda 3"],
                [testPlayers[2], "Risposta assurda 1"],
            ] as const
            for (const [voter, answerText] of circularVotes) {
                const answerId = answerByPlayerId.get(answerText)
                assert.ok(answerId)
                const voteResult = await emitSelection(
                    playerSockets.get(voter.id)!,
                    [answerId]
                )
                assert.deepEqual(voteResult, { ok: true, data: { selected: true } })
            }

            const results = (await Promise.all(completedEvents)) as PlayerGameView[]
            const finalView = results[0]
            assert.ok(
                results.every(
                    (view) =>
                        view.currentRound.phase === "round_result" &&
                        view.currentRound.selectedAnswerIds.length === testPlayers.length &&
                        view.currentRound.answers.every(
                            (answer) => answer.authorId !== undefined
                        )
                )
            )
            assert.ok(
                finalView.players.every(
                    (player) =>
                        player.score ===
                        (startedViews[0].players.find((before) => before.id === player.id)
                            ?.score ?? 0) + 4
                )
            )

            const persistedAnswers = await getDatabase()
                .select({ isOriginalAnswer: answers.isOriginalAnswer })
                .from(answers)
                .innerJoin(rounds, eq(answers.roundId, rounds.id))
                .where(eq(rounds.roomId, roomId!))
            assert.equal(persistedAnswers.length, testPlayers.length)
            assert.ok(persistedAnswers.every((answer) => !answer.isOriginalAnswer))
            const [persistedRound] = await getDatabase()
                .select({ questionId: rounds.questionId, gamePromptId: rounds.gamePromptId })
                .from(rounds)
                .where(eq(rounds.roomId, roomId!))
                .limit(1)
            assert.equal(persistedRound.questionId, null)
            assert.ok(persistedRound.gamePromptId)
        })

        it("plays an absurd-situations round with four connected players", async (testContext) => {
            const scopedSockets = new Set<TestSocket>()
            testContext.after(async () => {
                for (const socket of scopedSockets) socket.disconnect()
                await waitForRoomDisconnections()
                await cleanTestRoom()
            })

            const initialPlayers = await createTestRoom()
            const guestCSessionTokenHash = hashPlayerSessionToken(
                randomBytes(32).toString("base64url")
            )
            const guestC = await joinRoom(
                { code: roomCode!, nickname: "IntegrationGuestC", avatar: "leaf" },
                guestCSessionTokenHash
            )
            const testPlayers = [
                ...initialPlayers,
                {
                    id: guestC.playerId,
                    nickname: "IntegrationGuestC",
                    sessionTokenHash: guestCSessionTokenHash,
                },
            ]
            const playerSockets = new Map<string, TestSocket>()
            for (const player of testPlayers) {
                const socket = await connectPlayer(player)
                scopedSockets.add(socket)
                playerSockets.set(player.id, socket)
            }
            const hostSocket = playerSockets.get(testPlayers[0].id)
            assert.ok(hostSocket)

            const [roomSettings] = await getDatabase()
                .select({ settings: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            const settingsResult = await emitRoomSettings(hostSocket, {
                ...roomSettings.settings,
                mode: "absurd_situations",
                enabledCategories: ["friendship"],
            })
            assert.equal(settingsResult.ok, true)

            const startEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:started")
            )
            assert.equal((await emitRoomStart(hostSocket)).ok, true)
            const startedViews = (await Promise.all(startEvents)) as PlayerGameView[]
            assert.ok(
                startedViews.every(
                    (view) =>
                        view.players.length === 4 &&
                        view.currentRound.requiredAnswerCount === 4
                )
            )

            const revealEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "round:reveal")
            )
            for (const [index, player] of testPlayers.entries()) {
                assert.equal(
                    (
                        await emitAnswer(
                            playerSockets.get(player.id)!,
                            `Quattro giocatori risposta ${index + 1}`
                        )
                    ).ok,
                    true
                )
            }
            const [revealedView] = (await Promise.all(revealEvents)) as PlayerGameView[]
            assert.equal(revealedView.currentRound.answers.length, 4)

            const selectionEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(
                    socket,
                    "round:answer-phase",
                    (phase) => phase.phase === "protagonist_selection"
                )
            )
            await Promise.all(selectionEvents)
            const answerIdByPlayerId = new Map(
                revealedView.currentRound.answers.map((answer) => {
                    const playerIndex = testPlayers.findIndex(
                        (_player, index) =>
                            answer.content === `Quattro giocatori risposta ${index + 1}`
                    )
                    assert.ok(playerIndex >= 0)
                    return [testPlayers[playerIndex].id, answer.id] as const
                })
            )
            const completedEvents = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "round:completed")
            )
            for (let voterIndex = 0; voterIndex < testPlayers.length; voterIndex += 1) {
                const voter = testPlayers[voterIndex]
                const target = testPlayers[(voterIndex + 1) % testPlayers.length]
                const answerId = answerIdByPlayerId.get(target.id)
                assert.ok(answerId)
                assert.notEqual(voter.id, target.id)
                assert.equal(
                    (await emitSelection(playerSockets.get(voter.id)!, [answerId])).ok,
                    true
                )
            }

            const results = (await Promise.all(completedEvents)) as PlayerGameView[]
            assert.ok(
                results.every(
                    (view) =>
                        view.currentRound.phase === "round_result" &&
                        view.currentRound.selectedAnswerIds.length === 4 &&
                        view.players.every((player) => player.score === 4)
                )
            )
            const persistedVotes = await getDatabase()
                .select({ id: votes.id })
                .from(votes)
                .innerJoin(rounds, eq(votes.roundId, rounds.id))
                .where(eq(rounds.roomId, roomId!))
            assert.equal(persistedVotes.length, 4)
        })

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

            const currentSettings = await getDatabase()
                .select({ settings: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            const rejectedGuestSettings = await emitRoomSettings(
                playerSockets.get(testPlayers[1].id)!,
                { ...currentSettings[0].settings, mode: "absurd_situations" }
            )
            assert.equal(rejectedGuestSettings.ok, false)
            if (!rejectedGuestSettings.ok) {
                assert.equal(rejectedGuestSettings.code, "HOST_REQUIRED")
            }
            const savedMode = await emitRoomSettings(hostSocket, {
                ...currentSettings[0].settings,
                mode: "classic",
            })
            assert.equal(savedMode.ok, true)
            const [persistedMode] = await getDatabase()
                .select({ mode: rooms.settings })
                .from(rooms)
                .where(eq(rooms.id, roomId!))
                .limit(1)
            assert.equal(persistedMode.mode.mode, "classic")

            const initialViews = [...playerSockets.values()].map((socket) =>
                waitForEvent(socket, "game:started")
            )
            const startResult = await emitRoomStart(hostSocket)
            assert.equal(startResult.ok, true)
            const settingsAfterStart = await emitRoomSettings(hostSocket, {
                ...currentSettings[0].settings,
                mode: "absurd_situations",
            })
            assert.equal(settingsAfterStart.ok, false)
            if (!settingsAfterStart.ok) {
                assert.equal(settingsAfterStart.code, "ROOM_UNAVAILABLE")
            }
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
