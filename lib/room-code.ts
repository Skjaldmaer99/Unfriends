import { randomInt } from "node:crypto"

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const ROOM_CODE_LENGTH = 6

export function generateRoomCode(
  chooseIndex: (maximumExclusive: number) => number = (maximumExclusive) =>
    randomInt(maximumExclusive)
): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = chooseIndex(ROOM_CODE_ALPHABET.length)
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= ROOM_CODE_ALPHABET.length
    ) {
      throw new RangeError(
        "Room code index must be within the alphabet bounds."
      )
    }
    return ROOM_CODE_ALPHABET[index]
  }).join("")
}
