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

    it("plays Bluff with a hidden verified answer, secret votes, and bounded scoring", () => {
        const bluffQuestion = {
            id: "bq1",
            text: "Qual è il pianeta più grande del Sistema Solare?",
            correctAnswer: "Giove",
            explanation: "Giove è il pianeta più grande del Sistema Solare.",
            sourceUrl: "https://science.nasa.gov/jupiter/",
            category: "general_knowledge" as const,
            difficulty: "easy" as const,
        }
        let state = createGame({
            players,
            questions: [],
            bluffQuestions: [bluffQuestion],
            settings: { mode: "bluff", roundsPerPlayer: 1 },
            now: 1_000,
            random: () => 0,
        })

        assert.equal(state.currentRound.phase, "players_answer")
        assert.equal(state.currentRound.bluffCorrectAnswer, "Giove")
        assert.equal(getPlayerGameView(state, "p2").currentRound.bluffExplanation, undefined)

        for (const [index, player] of state.players.entries()) {
            state = submitPlayerAnswer(state, player.id, `Falso plausibile ${index}`, 2_000)
            assert.equal(getPlayerGameView(state, player.id).currentRound.hasSubmittedAnswer, true)
        }
        assert.equal(state.currentRound.phase, "reveal")
        assert.equal(state.currentRound.answers.length, 3)
        assert.equal(
            getPlayerGameView(state, "p2").currentRound.answers.some(
                (answer) => answer.content === "Giove"
            ),
            false
        )

        state = beginSelection(state, 3_000)
        assert.equal(state.currentRound.answers.length, 4)
        const correctAnswer = state.currentRound.answers.find(
            (answer) => answer.isCorrectAnswer
        )
        assert.ok(correctAnswer)
        assert.match(correctAnswer.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        assert.notEqual(correctAnswer.id, `${state.currentRound.id}:correct`)
        const fakeAnswerByPlayerId = new Map(
            state.currentRound.answers
                .filter((answer) => answer.playerId !== null)
                .map((answer) => [answer.playerId!, answer.id])
        )

        const preResultView = getPlayerGameView(state, "p2")
        assert.ok(preResultView.currentRound.answers.some((answer) => answer.content === "Giove"))
        assert.ok(preResultView.currentRound.answers.every((answer) => !answer.isCorrectAnswer))
        assert.equal(preResultView.currentRound.bluffExplanation, undefined)

        assertRuleError(
            () => selectWinningAnswer(state, "p1", [fakeAnswerByPlayerId.get("p1")!], 3_100),
            "PROTAGONIST_CANNOT_GUESS"
        )
        state = selectWinningAnswer(state, "p1", [correctAnswer.id], 3_100)
        assert.equal(state.currentRound.phase, "protagonist_selection")
        assertRuleError(
            () => selectWinningAnswer(state, "p1", [correctAnswer.id], 3_200),
            "VOTE_ALREADY_SUBMITTED"
        )
        state = selectWinningAnswer(state, "p2", [fakeAnswerByPlayerId.get("p1")!], 3_200)
        state = selectWinningAnswer(state, "p3", [correctAnswer.id], 3_300)

        assert.equal(state.currentRound.phase, "round_result")
        assert.deepEqual(state.currentRound.selectedAnswerIds, [correctAnswer.id])
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 3],
                ["p2", 0],
                ["p3", 2],
            ]
        )
        const resultView = getPlayerGameView(state, "p2")
        assert.equal(resultView.currentRound.bluffExplanation, bluffQuestion.explanation)
        assert.equal(resultView.currentRound.bluffSourceUrl, bluffQuestion.sourceUrl)
        assert.equal(
            resultView.currentRound.answers.find((answer) => answer.id === correctAnswer.id)
                ?.isCorrectAnswer,
            true
        )
        assert.equal(
            "votes" in resultView.currentRound,
            false,
            "individual voters are never included in player views"
        )
    })

    it("resolves a partial Bluff ballot when the voting deadline expires", () => {
        let state = createGame({
            players,
            questions: [],
            bluffQuestions: [
                {
                    id: "bq-timeout",
                    text: "Qual è il pianeta più grande?",
                    correctAnswer: "Giove",
                    explanation: "Giove è il più grande.",
                    sourceUrl: "https://science.nasa.gov/jupiter/",
                    category: "general_knowledge",
                    difficulty: "easy",
                },
            ],
            settings: {
                mode: "bluff",
                roundsPerPlayer: 1,
                selectionTimeLimitSeconds: 5,
            },
            now: 1_000,
            random: () => 0,
        })
        for (const [index, player] of state.players.entries()) {
            state = submitPlayerAnswer(state, player.id, `Falso ${index}`, 2_000)
        }
        state = beginSelection(state, 3_000)
        const correctAnswerId = state.currentRound.bluffCorrectAnswerId
        assert.ok(correctAnswerId)
        state = selectWinningAnswer(state, "p1", [correctAnswerId], 3_100)
        assert.equal(state.currentRound.phase, "protagonist_selection")

        state = expireCurrentPhase(state, state.currentRound.deadlineAt! + 1)

        assert.equal(state.currentRound.phase, "round_result")
        assert.deepEqual(state.currentRound.selectedAnswerIds, [correctAnswerId])
        assert.deepEqual(
            state.players.map(({ id, score }) => [id, score]),
            [
                ["p1", 2],
                ["p2", 0],
                ["p3", 0],
            ]
        )
    })

    it("still reveals and scores the verified Bluff answer if no fake was submitted", () => {
        let state = createGame({
            players,
            questions: [],
            bluffQuestions: [
                {
                    id: "bq-empty",
                    text: "Qual è il pianeta più grande?",
                    correctAnswer: "Giove",
                    explanation: "Giove è il più grande.",
                    sourceUrl: "https://science.nasa.gov/jupiter/",
                    category: "general_knowledge",
                    difficulty: "easy",
                },
            ],
            settings: {
                mode: "bluff",
                roundsPerPlayer: 1,
                selectionTimeLimitSeconds: 5,
            },
            now: 1_000,
            random: () => 0,
        })

        state = expireCurrentPhase(state, state.currentRound.deadlineAt! + 1)
        assert.equal(state.currentRound.phase, "reveal")
        assert.equal(getPlayerGameView(state, "p1").currentRound.bluffSourceUrl, undefined)
        state = beginSelection(state, 62_000)
        const correctAnswerId = state.currentRound.bluffCorrectAnswerId
        assert.ok(correctAnswerId)
        assert.deepEqual(
            new Set(state.currentRound.answers.map((answer) => answer.id)),
            new Set([correctAnswerId])
        )
        for (const player of players) {
            state = selectWinningAnswer(state, player.id, [correctAnswerId], 63_000)
        }

        assert.equal(state.currentRound.phase, "round_result")
        assert.ok(state.players.every((player) => player.score === 2))
    })

    it("runs Who Among Us ballots with private votes, ties, and optional scoring", () => {
        const prompt = {
            id: "who-q1",
            text: "Chi si perderebbe per primo durante un viaggio?",
            category: "travel" as const,
            difficulty: "easy" as const,
        }
        const createWhoGame = (scoringEnabled = true) =>
            createGame({
                players,
                questions: [prompt],
                settings: {
                    mode: "who_among_us",
                    scoringEnabled,
                    roundsPerPlayer: 1,
                },
                now: 1_000,
                random: () => 0,
            })

        const state = createWhoGame()
        assert.equal(state.currentRound.phase, "protagonist_selection")
        assert.equal(state.currentRound.answers.length, players.length)
        const candidateIdByPlayer = new Map(
            state.currentRound.answers.map((answer) => [answer.playerId, answer.id])
        )
        assert.ok(candidateIdByPlayer.get("p1"))
        assert.ok(candidateIdByPlayer.get("p2"))
        assert.ok(candidateIdByPlayer.get("p3"))

        const pending = selectWinningAnswer(
            state,
            "p1",
            [candidateIdByPlayer.get("p2")!],
            1_100
        )
        assert.equal(pending.currentRound.phase, "protagonist_selection")
        assert.equal(getPlayerGameView(pending, "p2").currentRound.voteCount, 1)
        assert.equal(getPlayerGameView(pending, "p2").currentRound.hasSubmittedVote, false)
        assert.equal("votes" in getPlayerGameView(pending, "p2").currentRound, false)
        assert.equal(
            getPlayerGameView(pending, "p2").currentRound.answers.find(
                (answer) => answer.isOwnAnswer
            )?.content,
            "Leo"
        )
        assert.equal(
            "authorId" in getPlayerGameView(pending, "p2").currentRound.answers[0],
            false
        )
        assertRuleError(
            () => selectWinningAnswer(pending, "p2", [candidateIdByPlayer.get("p2")!], 1_150),
            "PROTAGONIST_CANNOT_GUESS"
        )
        assertRuleError(
            () => selectWinningAnswer(pending, "p1", [candidateIdByPlayer.get("p3")!], 1_160),
            "VOTE_ALREADY_SUBMITTED"
        )

        let resolved = selectWinningAnswer(
            pending,
            "p2",
            [candidateIdByPlayer.get("p3")!],
            1_200
        )
        resolved = selectWinningAnswer(
            resolved,
            "p3",
            [candidateIdByPlayer.get("p1")!],
            1_300
        )
        assert.equal(resolved.currentRound.phase, "round_result")
        assert.deepEqual(
            new Set(resolved.currentRound.selectedAnswerIds),
            new Set([
                candidateIdByPlayer.get("p1"),
                candidateIdByPlayer.get("p2"),
                candidateIdByPlayer.get("p3"),
            ])
        )
        assert.deepEqual(
            resolved.players.map(({ id, score }) => [id, score]),
            [["p1", 3], ["p2", 3], ["p3", 3]]
        )
        const resultView = getPlayerGameView(resolved, "p1")
        assert.equal(resultView.currentRound.answers.find(
            (answer) => answer.id === candidateIdByPlayer.get("p2")
        )?.voteCount, 1)

        let unscored = createWhoGame(false)
        const unscoredCandidateIdByPlayer = new Map(
            unscored.currentRound.answers.map((answer) => [answer.playerId, answer.id])
        )
        for (const [voterIndex, targetId] of ["p2", "p3", "p1"].entries()) {
            unscored = selectWinningAnswer(
                unscored,
                players[voterIndex].id,
                [unscoredCandidateIdByPlayer.get(targetId)!],
                1_500 + voterIndex
            )
        }
        assert.ok(unscored.players.every((player) => player.score === 0))
        assert.deepEqual(
            new Set(unscored.currentRound.selectedAnswerIds),
            new Set([
                unscoredCandidateIdByPlayer.get("p1"),
                unscoredCandidateIdByPlayer.get("p2"),
                unscoredCandidateIdByPlayer.get("p3"),
            ])
        )
    })
})
