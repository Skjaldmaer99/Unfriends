import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  createPlayerSessionToken,
  hashPlayerSessionToken,
  PLAYER_SESSION_MAX_AGE_SECONDS,
} from "./player-session.js"

describe("player session tokens", () => {
  it("creates unguessable-format tokens and stores a fixed-length digest", () => {
    const token = createPlayerSessionToken()
    const digest = hashPlayerSessionToken(token)

    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.match(digest, /^[a-f0-9]{64}$/)
    assert.notEqual(digest, token)
    assert.equal(PLAYER_SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60)
  })

  it("produces the same digest for a recovered token", () => {
    const token = createPlayerSessionToken()
    assert.equal(hashPlayerSessionToken(token), hashPlayerSessionToken(token))
  })
})
