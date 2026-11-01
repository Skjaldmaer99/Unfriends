import assert from "node:assert/strict"
import { after, describe, it } from "node:test"

import { createSocketTicket, verifySocketTicket } from "./socket-ticket.js"

const originalSecret = process.env.SOCKET_TICKET_SECRET
process.env.SOCKET_TICKET_SECRET = "test-secret-with-at-least-32-characters"

after(() => {
  if (originalSecret === undefined) {
    delete process.env.SOCKET_TICKET_SECRET
  } else {
    process.env.SOCKET_TICKET_SECRET = originalSecret
  }
})

describe("socket tickets", () => {
  it("signs a short-lived ticket scoped to the room and player", async () => {
    const claims = {
      playerId: "123e4567-e89b-42d3-a456-426614174000",
      roomCode: "AB23XY",
    }
    const ticket = await createSocketTicket(claims)

    assert.deepEqual(await verifySocketTicket(ticket), claims)
  })

  it("rejects malformed or tampered tickets", async () => {
    const ticket = await createSocketTicket({
      playerId: "123e4567-e89b-42d3-a456-426614174000",
      roomCode: "AB23XY",
    })

    assert.equal(await verifySocketTicket(`${ticket}x`), null)
    assert.equal(await verifySocketTicket("not-a-jwt"), null)
  })

  it("rejects invalid claims before signing", async () => {
    await assert.rejects(
      () => createSocketTicket({ playerId: "player", roomCode: "AB23XY" }),
      TypeError
    )
  })
})
