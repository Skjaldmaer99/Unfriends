import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    advanceRound,
    beginSelection,
    createGame,
    expireCurrentPhase,
    GameRuleError,
    type GameRuleErrorCode,
    getPlayerGameView,
    selectWinningAnswer,
    submitPlayerAnswer,
    submitProtagonistAnswer,
} from "./game-engine.js"
import type { GameQuestion, GameState } from "./types.js"

const players = [
    { id: "p1", nickname: "Ada" },
    { id: "p2", nickname: "Leo" },
    { id: "p3", nickname: "Mina" },
]

const questions: GameQuestion[] = [
    {
        id: "q1",
        text: "What makes you feel appreciated?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        id: "q2",
        text: "What would you never forgive?",
        category: "personality",
        difficulty: "medium",
    },
]

function createThreePlayerGame(): GameState {
    return createGame({
        players,
        questions,
        settings: { roundsPerPlayer: 1 },
        now: 1_000,
        random: () => 0,
    })
}

function assertRuleError(action: () => unknown, code: GameRuleErrorCode): void {
    assert.throws(
        action,
        (error: unknown) => error instanceof GameRuleError && error.code === code
    )
}

function finishCurrentRound(state: GameState, now: number): GameState {
    let nextState = submitProtagonistAnswer(
        state,
        state.currentRound.protagonistId,
        "The original answer",
        now
    )

    for (const player of nextState.players) {
        if (player.id !== nextState.currentRound.protagonistId) {
            nextState = submitPlayerAnswer(
                nextState,
                player.id,
                `Guess from ${player.nickname}`,
                now
            )
        }
    }

    nextState = beginSelection(nextState, now)
    const selectedAnswer = nextState.currentRound.answers[0]
    return selectWinningAnswer(
        nextState,
        nextState.currentRound.protagonistId,
        [selectedAnswer.id],
        now
    )
}

describe("gameplay rules", () => {
    it("keeps answers private, reveals guesses anonymously, then scores one choice", () => {
        let state = createThreePlayerGame()
        state = submitProtagonistAnswer(state, "p1", "Being left out", 2_000)

        let view = getPlayerGameView(state, "p2")
        assert.equal(view.currentRound.originalAnswer, undefined)
        assert.deepEqual(view.currentRound.answers, [])

        state = submitPlayerAnswer(state, "p2", "Being ignored", 3_000)
        view = getPlayerGameView(state, "p3")
        assert.equal(view.currentRound.answerCount, 1)
        assert.deepEqual(view.currentRound.answers, [])

        state = submitPlayerAnswer(state, "p3", "Being excluded", 4_000)
        assert.equal(state.currentRound.phase, "reveal")

        view = getPlayerGameView(state, "p2")
        assert.equal(view.currentRound.originalAnswer, undefined)
        assert.deepEqual(
            view.currentRound.answers.map(({ id, content }) => ({ id, content })),
            state.currentRound.answers.map(({ id, content }) => ({ id, content }))
        )
        assert.equal("authorId" in view.currentRound.answers[0], false)

        state = beginSelection(state, 5_000)
        const selectedAnswer = state.currentRound.answers[0]
        state = selectWinningAnswer(state, "p1", [selectedAnswer.id], 6_000)

        assert.equal(state.currentRound.phase, "round_result")
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 1],
                [selectedAnswer.playerId, 3],
                [state.currentRound.answers[1].playerId, 0],
            ]
        )

        view = getPlayerGameView(state, "p3")
        assert.equal(view.currentRound.originalAnswer, "Being left out")
        assert.equal(view.currentRound.answers[0].authorId, selectedAnswer.playerId)
    })

    it("supports two-player rounds and finishes after the configured turn count", () => {
        const state = createGame({
            players: players.slice(0, 2),
            questions,
            settings: { roundsPerPlayer: 1 },
            now: 1_000,
            random: () => 0,
        })
        const firstResult = finishCurrentRound(state, 2_000)
        const secondRound = advanceRound(firstResult, 3_000)
        assert.equal(secondRound.currentRound.protagonistId, "p2")
        const secondResult = finishCurrentRound(secondRound, 4_000)
        const finished = advanceRound(secondResult, 5_000)

        assert.equal(finished.status, "finished")
        assert.equal(finished.currentRound.phase, "finished")
        assert.deepEqual(
            finished.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 4],
                ["p2", 4],
            ]
        )
        assertRuleError(() => advanceRound(finished), "WRONG_PHASE")
    })

    it("rotates protagonists in order and completes every configured round", () => {
        let state = createGame({
            players,
            questions,
            settings: { roundsPerPlayer: 2 },
            now: 1_000,
            random: () => 0,
        })
        const protagonists: string[] = []
        let now = 2_000

        while (state.status === "in_progress") {
            protagonists.push(state.currentRound.protagonistId)
            const withResult = finishCurrentRound(state, now)
            now += 1_000
            state = advanceRound(withResult, now, () => 0)
        }

        assert.deepEqual(protagonists, ["p1", "p2", "p3", "p1", "p2", "p3"])
        assert.equal(state.currentRound.number, 6)
        assert.equal(state.totalRounds, 6)
    })

    it("rejects duplicate, invalid, unauthorized, and expired submissions", () => {
        let state = createThreePlayerGame()
        assertRuleError(
            () => submitProtagonistAnswer(state, "p2", "No", 2_000),
            "NOT_PROTAGONIST"
        )
        assertRuleError(
            () => submitProtagonistAnswer(state, "p1", " ", 2_000),
            "INVALID_ANSWER"
        )
        assertRuleError(
            () => submitProtagonistAnswer(state, "p1", "Too late", 62_000),
            "ANSWER_EXPIRED"
        )

        state = submitProtagonistAnswer(state, "p1", "Original", 2_000)
        state = submitPlayerAnswer(state, "p2", "Guess", 3_000)
        assertRuleError(
            () => submitPlayerAnswer(state, "p2", "Second guess", 4_000),
            "ANSWER_ALREADY_SUBMITTED"
        )
        assertRuleError(
            () => submitPlayerAnswer(state, "p1", "Own guess", 4_000),
            "PROTAGONIST_CANNOT_GUESS"
        )
    })

    it("lets the protagonist choose one answer even when guesses match", () => {
        let state = createThreePlayerGame()
        state = submitProtagonistAnswer(state, "p1", "Original", 2_000)
        state = submitPlayerAnswer(state, "p2", "Same guess", 3_000)
        state = submitPlayerAnswer(state, "p3", "Same guess", 4_000)
        state = beginSelection(state, 5_000)

        assertRuleError(
            () =>
                selectWinningAnswer(
                    state,
                    "p2",
                    [state.currentRound.answers[0].id],
                    6_000
                ),
            "NOT_PROTAGONIST"
        )

        const selected = state.currentRound.answers[1]
        state = selectWinningAnswer(state, "p1", [selected.id], 6_000)
        assert.deepEqual(state.currentRound.selectedAnswerIds, [selected.id])
        assert.equal(
            state.players.find((player) => player.id === selected.playerId)?.score,
            3
        )
        assert.equal(
            state.players.find(
                (player) => player.id === state.currentRound.answers[0].playerId
            )?.score,
            0
        )
    })

    it("resolves expired answer and selection phases without stalling the game", () => {
        const initialState = createThreePlayerGame()
        assertRuleError(
            () => expireCurrentPhase(initialState, 61_000),
            "PHASE_NOT_EXPIRED"
        )

        const unansweredProtagonist = expireCurrentPhase(initialState, 62_000)
        assert.equal(unansweredProtagonist.currentRound.phase, "round_result")
        assert.deepEqual(
            unansweredProtagonist.players.map((player) => player.score),
            [0, 0, 0]
        )

        const withOriginal = submitProtagonistAnswer(
            initialState,
            "p1",
            "Original",
            2_000
        )
        const noGuesses = expireCurrentPhase(withOriginal, 62_001)
        assert.equal(noGuesses.currentRound.phase, "round_result")
        assert.equal(noGuesses.players[0].score, 1)

        const withOneGuess = submitPlayerAnswer(
            withOriginal,
            "p2",
            "Closest guess",
            3_000
        )
        const partialReveal = expireCurrentPhase(withOneGuess, 62_001)
        assert.equal(partialReveal.currentRound.phase, "reveal")
        assert.equal(partialReveal.currentRound.answers.length, 1)

        const selectionState = beginSelection(partialReveal, 63_000)
        const timedOutSelection = expireCurrentPhase(selectionState, 93_001)
        assert.equal(timedOutSelection.currentRound.phase, "round_result")
        assert.deepEqual(timedOutSelection.currentRound.selectedAnswerIds, [])
        assert.equal(timedOutSelection.players[0].score, 1)
    })

    it("awards one protagonist point and three points to each distinct selected answer", () => {
        let state = createThreePlayerGame()
        state = submitProtagonistAnswer(state, "p1", "Original", 2_000)
        state = submitPlayerAnswer(state, "p2", "First guess", 3_000)
        state = submitPlayerAnswer(state, "p3", "Second guess", 4_000)
        state = beginSelection(state, 5_000)

        const selectionState = state
        const [firstAnswer, secondAnswer] = state.currentRound.answers
        state = selectWinningAnswer(
            state,
            "p1",
            [firstAnswer.id, secondAnswer.id],
            6_000
        )

        assert.deepEqual(state.currentRound.selectedAnswerIds, [
            firstAnswer.id,
            secondAnswer.id,
        ])
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 1],
                [firstAnswer.playerId, 3],
                [secondAnswer.playerId, 3],
            ]
        )

        assertRuleError(
            () => selectWinningAnswer(selectionState, "p1", [], 6_001),
            "NO_ANSWERS_SELECTED"
        )
        assertRuleError(
            () =>
                selectWinningAnswer(
                    selectionState,
                    "p1",
                    [firstAnswer.id, firstAnswer.id],
                    6_001
                ),
            "DUPLICATE_SELECTED_ANSWER"
        )
    })

    it("runs absurd situations with secret one-person votes, ties, and voter bonus", () => {
        const fourPlayers = [
            ...players,
            { id: "p4", nickname: "Nico" },
        ]
        let state = createGame({
            players: fourPlayers,
            questions,
            settings: { mode: "absurd_situations", roundsPerPlayer: 1 },
            now: 1_000,
            random: () => 0,
        })
        assert.equal(state.currentRound.phase, "players_answer")
        assert.equal(state.currentRound.originalAnswer, null)

        for (const player of fourPlayers) {
            state = submitPlayerAnswer(
                state,
                player.id,
                `Absurd answer from ${player.nickname}`,
                2_000
            )
        }
        assert.equal(state.currentRound.phase, "reveal")
        state = beginSelection(state, 3_000)

        const answerByPlayerId = new Map(
            state.currentRound.answers.map((answer) => [answer.playerId, answer.id])
        )
        assertRuleError(
            () => selectWinningAnswer(state, "p1", [answerByPlayerId.get("p1")!], 4_000),
            "PROTAGONIST_CANNOT_GUESS"
        )

        state = selectWinningAnswer(
            state,
            "p1",
            [answerByPlayerId.get("p2")!],
            4_000
        )
        assert.equal(state.currentRound.phase, "protagonist_selection")
        assert.equal(state.currentRound.votes.length, 1)
        assert.equal(getPlayerGameView(state, "p1").currentRound.voteCount, 1)
        assert.equal(getPlayerGameView(state, "p2").currentRound.hasSubmittedVote, false)
        assert.equal(
            "votes" in state.currentRound,
            true,
            "votes stay in the server snapshot and are not part of player views"
        )
        assertRuleError(
            () => selectWinningAnswer(state, "p1", [answerByPlayerId.get("p3")!], 4_001),
            "VOTE_ALREADY_SUBMITTED"
        )

        state = selectWinningAnswer(
            state,
            "p2",
            [answerByPlayerId.get("p1")!],
            4_100
        )
        state = selectWinningAnswer(
            state,
            "p3",
            [answerByPlayerId.get("p1")!],
            4_200
        )
        state = selectWinningAnswer(
            state,
            "p4",
            [answerByPlayerId.get("p2")!],
            4_300
        )

        assert.equal(state.currentRound.phase, "round_result")
        assert.deepEqual(
            new Set(state.currentRound.selectedAnswerIds),
            new Set([answerByPlayerId.get("p1"), answerByPlayerId.get("p2")])
        )
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 4],
                ["p2", 4],
                ["p3", 1],
                ["p4", 1],
            ]
        )
        assert.equal(getPlayerGameView(state, "p3").currentRound.hasSubmittedVote, true)
        assert.equal(
            "votes" in getPlayerGameView(state, "p3").currentRound,
            false
        )
    })

    it("supports absurd situations answers, secret votes, ties, and voter bonus", () => {
        const absurdPlayers = [
            ...players,
            { id: "p4", nickname: "Nico" },
        ]
        let state = createGame({
            players: absurdPlayers,
            questions,
            settings: { mode: "absurd_situations", roundsPerPlayer: 1 },
            now: 1_000,
            random: () => 0,
        })
        assert.equal(state.currentRound.phase, "players_answer")
        assert.equal(state.currentRound.originalAnswer, null)

        for (const player of absurdPlayers) {
            state = submitPlayerAnswer(
                state,
                player.id,
                `Absurd answer from ${player.nickname}`,
                2_000
            )
        }
        assert.equal(state.currentRound.phase, "reveal")
        state = beginSelection(state, 3_000)
        const answerByPlayerId = new Map(
            state.currentRound.answers.map((answer) => [answer.playerId, answer.id])
        )

        assertRuleError(
            () =>
                selectWinningAnswer(state, "p1", [answerByPlayerId.get("p1")!], 4_000),
            "PROTAGONIST_CANNOT_GUESS"
        )

        state = selectWinningAnswer(
            state,
            "p1",
            [answerByPlayerId.get("p2")!],
            4_000
        )
        assert.equal(state.currentRound.phase, "protagonist_selection")
        assert.equal(state.currentRound.votes.length, 1)
        assert.equal(getPlayerGameView(state, "p1").currentRound.voteCount, 1)
        assert.equal(getPlayerGameView(state, "p2").currentRound.hasSubmittedVote, false)
        assert.equal("votes" in getPlayerGameView(state, "p1").currentRound, false)

        assertRuleError(
            () =>
                selectWinningAnswer(state, "p1", [answerByPlayerId.get("p3")!], 4_001),
            "VOTE_ALREADY_SUBMITTED"
        )

        state = selectWinningAnswer(
            state,
            "p2",
            [answerByPlayerId.get("p1")!],
            4_100
        )
        state = selectWinningAnswer(
            state,
            "p3",
            [answerByPlayerId.get("p1")!],
            4_200
        )
        state = selectWinningAnswer(
            state,
            "p4",
            [answerByPlayerId.get("p2")!],
            4_300
        )

        assert.equal(state.currentRound.phase, "round_result")
        assert.deepEqual(new Set(state.currentRound.selectedAnswerIds), new Set([
            answerByPlayerId.get("p1"),
            answerByPlayerId.get("p2"),
        ]))
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 4],
                ["p2", 4],
                ["p3", 1],
                ["p4", 1],
            ]
        )
    })
})
