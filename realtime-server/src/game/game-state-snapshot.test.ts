import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createGame } from "./game-engine.js"
import { GameStateSnapshotSchema } from "./types.js"

const questions = [
  {
    id: "question-1",
    text: "What makes you feel appreciated?",
    category: "friendship" as const,
    difficulty: "easy" as const,
  },
]

describe("persisted game state snapshots", () => {
  it("accepts a game state produced by the authoritative engine", () => {
    const state = createGame({
      players: [
        { id: "player-1", nickname: "Ada" },
        { id: "player-2", nickname: "Leo" },
        { id: "player-3", nickname: "Mina" },
      ],
      questions,
      now: 1_000,
      random: () => 0,
    })

    assert.deepEqual(GameStateSnapshotSchema.parse(state), state)
  })

  it("rejects snapshots with invalid phase deadlines", () => {
    const state = createGame({
      players: [
        { id: "player-1", nickname: "Ada" },
        { id: "player-2", nickname: "Leo" },
      ],
      questions,
      now: 1_000,
      random: () => 0,
    })

    const invalidState = {
      ...state,
      currentRound: { ...state.currentRound, deadlineAt: Number.NaN },
    }

    assert.equal(GameStateSnapshotSchema.safeParse(invalidState).success, false)
  })
})
