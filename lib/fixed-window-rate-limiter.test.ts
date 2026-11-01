import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createFixedWindowRateLimiter } from "./fixed-window-rate-limiter.js"

describe("fixed window rate limiter", () => {
  it("rejects requests over the limit and resets at the window boundary", () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1_000 })

    assert.deepEqual(limiter.consume("player", 100), {
      allowed: true,
      retryAfterSeconds: 0,
    })
    assert.equal(limiter.consume("player", 200).allowed, true)
    assert.deepEqual(limiter.consume("player", 300), {
      allowed: false,
      retryAfterSeconds: 1,
    })
    assert.equal(limiter.consume("other-player", 300).allowed, true)
    assert.equal(limiter.consume("player", 1_100).allowed, true)
  })

  it("keeps tracked keys bounded", () => {
    const limiter = createFixedWindowRateLimiter({
      limit: 1,
      windowMs: 1_000,
      maxTrackedKeys: 1,
    })

    assert.equal(limiter.consume("first", 100).allowed, true)
    assert.equal(limiter.consume("second", 100).allowed, true)
    assert.equal(limiter.consume("second", 101).allowed, false)
  })

  it("rejects invalid limiter configuration", () => {
    assert.throws(
      () => createFixedWindowRateLimiter({ limit: 0, windowMs: 1_000 }),
      RangeError
    )
  })
})
