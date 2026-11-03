import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { clientEventSchemas, SocketTicketEventSchema } from "./protocol.js"

describe("realtime event schemas", () => {
  it("rejects player-controlled identity fields in round events", () => {
    assert.equal(
      clientEventSchemas["answer:submit"].safeParse({
        content: "A guess",
        playerId: "another-player",
      }).success,
      false
    )
  })

  it("bounds and trims submitted answers", () => {
    assert.deepEqual(
      clientEventSchemas["answer:submit"].parse({ content: " Guess " }),
      { content: "Guess" }
    )
    assert.equal(
      clientEventSchemas["answer:submit"].safeParse({
        content: "x".repeat(241),
      }).success,
      false
    )
    assert.equal(
      clientEventSchemas["answer:submit"].safeParse({
        content: "unsafe\u0000value",
      }).success,
      false
    )
  })

  it("accepts one or more distinct answer ids and rejects empty or duplicate selections", () => {
    assert.deepEqual(
      clientEventSchemas["answer:select"].parse({
        answerIds: ["answer-1", "answer-2"],
      }),
      { answerIds: ["answer-1", "answer-2"] }
    )
    assert.equal(
      clientEventSchemas["answer:select"].safeParse({ answerIds: [] }).success,
      false
    )
    assert.equal(
      clientEventSchemas["answer:select"].safeParse({
        answerIds: ["answer-1", "answer-1"],
      }).success,
      false
    )
  })

  it("accepts only scoped socket ticket claims", () => {
    assert.equal(
      SocketTicketEventSchema.safeParse({
        playerId: "123e4567-e89b-42d3-a456-426614174000",
        roomCode: "AB23XY",
      }).success,
      true
    )
    assert.equal(
      SocketTicketEventSchema.safeParse({
        playerId: "123e4567-e89b-42d3-a456-426614174000",
        roomCode: "A0I1OZ",
      }).success,
      false
    )
  })

  it("rejects room settings with no enabled question categories", () => {
    const defaults = {
      roundsPerPlayer: 2,
      answerTimeLimitSeconds: 60,
      selectionTimeLimitSeconds: 30,
    }

    assert.equal(
      clientEventSchemas["room:settings"].safeParse({
        settings: { ...defaults, enabledCategories: [] },
      }).success,
      false
    )
    assert.equal(
      clientEventSchemas["room:settings"].safeParse({
        settings: {
          ...defaults,
          enabledCategories: ["friendship", "fun"],
        },
      }).success,
      true
    )
    assert.equal(
      clientEventSchemas["room:settings"].safeParse({
        settings: {
          ...defaults,
          enabledCategories: ["friendship"],
          unexpected: true,
        },
      }).success,
      false
    )
  })

  it("accepts an empty replay command and rejects client-controlled room data", () => {
    assert.deepEqual(clientEventSchemas["game:replay"].parse({}), {})
    assert.equal(
      clientEventSchemas["game:replay"].safeParse({ roomCode: "OTHER1" })
        .success,
      false
    )
  })
})
