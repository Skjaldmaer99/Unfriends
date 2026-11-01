import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "./room-code.js"

describe("room code generation", () => {
  it("creates six uppercase characters from the unambiguous alphabet", () => {
    let nextIndex = 0
    const code = generateRoomCode(() => nextIndex++)

    assert.equal(code.length, ROOM_CODE_LENGTH)
    assert.equal(code, ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH))
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/)
  })

  it("rejects an invalid random source result", () => {
    assert.throws(() => generateRoomCode(() => ROOM_CODE_ALPHABET.length), RangeError)
  })
})