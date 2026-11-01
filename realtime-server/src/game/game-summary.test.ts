import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildGameSummary } from "./game-summary.js"

const players = [
  { id: "p1", nickname: "Ada", score: 1 },
  { id: "p2", nickname: "Leo", score: 3 },
  { id: "p3", nickname: "Mina", score: 0 },
]

describe("game completion summary", () => {
  it("calculates round, answer, exact-match and recognition statistics", () => {
    const summary = buildGameSummary({
      players,
      rounds: [
        { id: "r1", protagonistId: "p1" },
        { id: "r2", protagonistId: "p2" },
        { id: "r3", protagonistId: "p3" },
      ],
      answers: [
        {
          id: "a1",
          roundId: "r1",
          playerId: "p1",
          content: "Gelato",
          isOriginalAnswer: true,
        },
        {
          id: "a2",
          roundId: "r1",
          playerId: "p2",
          content: " gelato ",
          isOriginalAnswer: false,
        },
        {
          id: "a3",
          roundId: "r1",
          playerId: "p3",
          content: "Pizza",
          isOriginalAnswer: false,
        },
        {
          id: "a4",
          roundId: "r2",
          playerId: "p2",
          content: "Montagna",
          isOriginalAnswer: true,
        },
        {
          id: "a5",
          roundId: "r2",
          playerId: "p1",
          content: "Montagna",
          isOriginalAnswer: false,
        },
        {
          id: "a6",
          roundId: "r2",
          playerId: "p3",
          content: "Lago",
          isOriginalAnswer: false,
        },
        {
          id: "a7",
          roundId: "r3",
          playerId: "p3",
          content: "Blu",
          isOriginalAnswer: true,
        },
        {
          id: "a8",
          roundId: "r3",
          playerId: "p1",
          content: "Verde",
          isOriginalAnswer: false,
        },
        {
          id: "a9",
          roundId: "r3",
          playerId: "p2",
          content: "Rosso",
          isOriginalAnswer: false,
        },
      ],
      votes: [
        { roundId: "r1", selectedAnswerId: "a2" },
        { roundId: "r2", selectedAnswerId: "a5" },
        { roundId: "r3", selectedAnswerId: "a8" },
      ],
    })

    assert.equal(summary.roundsPlayed, 3)
    assert.equal(summary.answersSubmitted, 9)
    assert.equal(summary.originalAnswersGuessedExactly, 2)
    assert.equal(summary.exactGuessPercentage, 67)
    assert.deepEqual(summary.recognitions, [
      {
        title: "Miglior osservatore",
        playerId: "p1",
        nickname: "Ada",
        detail: "2 risposte scelte",
      },
      {
        title: "Il più difficile da indovinare",
        playerId: "p3",
        nickname: "Mina",
        detail: "0 risposte esatte su 1",
      },
    ])
  })

  it("returns empty recognitions for a game with no completed rounds", () => {
    assert.deepEqual(
      buildGameSummary({ players, rounds: [], answers: [], votes: [] }),
      {
        roundsPlayed: 0,
        answersSubmitted: 0,
        originalAnswersGuessedExactly: 0,
        exactGuessPercentage: 0,
        recognitions: [],
      }
    )
  })
})
