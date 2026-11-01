import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  JoinRoomSchema,
  PlayerIdentitySchema,
  RoomCodeSchema,
} from "./room-input.js"

describe("room request validation", () => {
  it("trims nicknames and defaults the avatar", () => {
    assert.deepEqual(PlayerIdentitySchema.parse({ nickname: "  Ada  " }), {
      nickname: "Ada",
      avatar: "sun",
    })
  })

  it("rejects blank or overlong nicknames and invalid avatar identifiers", () => {
    assert.equal(
      PlayerIdentitySchema.safeParse({ nickname: "  " }).success,
      false
    )
    assert.equal(
      PlayerIdentitySchema.safeParse({ nickname: "a".repeat(25) }).success,
      false
    )
    assert.equal(
      PlayerIdentitySchema.safeParse({ nickname: "Ada", avatar: "../../x" })
        .success,
      false
    )
    assert.equal(
      PlayerIdentitySchema.safeParse({ nickname: "Ada\nHost" }).success,
      false
    )
    assert.equal(
      PlayerIdentitySchema.safeParse({ nickname: "Ada", playerId: "forged" })
        .success,
      false
    )
  })

  it("normalizes room codes and rejects ambiguous characters", () => {
    assert.equal(RoomCodeSchema.parse("ab2xyz"), "AB2XYZ")
    assert.equal(RoomCodeSchema.safeParse("A0I1OZ").success, false)
    assert.equal(
      JoinRoomSchema.parse({ code: "ab2xyz", nickname: "Ada" }).code,
      "AB2XYZ"
    )
  })
})
