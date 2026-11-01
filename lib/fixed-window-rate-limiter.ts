export interface FixedWindowRateLimiterOptions {
  limit: number
  windowMs: number
  maxTrackedKeys?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

interface WindowEntry {
  count: number
  resetAt: number
}

export function createFixedWindowRateLimiter({
  limit,
  windowMs,
  maxTrackedKeys = 10_000,
}: FixedWindowRateLimiterOptions) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(windowMs) ||
    windowMs < 1 ||
    !Number.isInteger(maxTrackedKeys) ||
    maxTrackedKeys < 1
  ) {
    throw new RangeError("Rate limit configuration must use positive integers.")
  }

  const entries = new Map<string, WindowEntry>()
  let callsSincePrune = 0

  function pruneExpired(now: number): void {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key)
    }
  }

  return {
    consume(key: string, now = Date.now()): RateLimitResult {
      if (!key) throw new TypeError("Rate limit keys cannot be empty.")
      if (!Number.isFinite(now) || now < 0) {
        throw new RangeError("Rate limit timestamps must be non-negative.")
      }

      callsSincePrune += 1
      if (callsSincePrune >= 128) {
        pruneExpired(now)
        callsSincePrune = 0
      }

      const current = entries.get(key)
      if (current && current.resetAt > now) {
        if (current.count >= limit) {
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((current.resetAt - now) / 1000)
            ),
          }
        }

        current.count += 1
        entries.set(key, current)
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (!current && entries.size >= maxTrackedKeys) {
        pruneExpired(now)
        if (entries.size >= maxTrackedKeys) {
          const oldestKey = entries.keys().next().value
          if (oldestKey !== undefined) entries.delete(oldestKey)
        }
      }

      entries.set(key, { count: 1, resetAt: now + windowMs })
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
