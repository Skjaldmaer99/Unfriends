import { SignJWT, jwtVerify } from "jose"

const TICKET_ISSUER = "unfriends-web"
const TICKET_AUDIENCE = "unfriends-realtime"
const TICKET_LIFETIME = "60s"
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/
const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface SocketTicketClaims {
  playerId: string
  roomCode: string
}

export class SocketTicketConfigurationError extends Error {
  constructor() {
    super("SOCKET_TICKET_SECRET must contain at least 32 characters.")
    this.name = "SocketTicketConfigurationError"
  }
}

export function assertSocketTicketConfiguration(): void {
  getSigningKey()
}

export async function createSocketTicket(
  claims: SocketTicketClaims
): Promise<string> {
  validateClaims(claims)

  return new SignJWT({ roomCode: claims.roomCode })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(TICKET_ISSUER)
    .setAudience(TICKET_AUDIENCE)
    .setSubject(claims.playerId)
    .setIssuedAt()
    .setExpirationTime(TICKET_LIFETIME)
    .sign(getSigningKey())
}

export async function verifySocketTicket(
  token: string
): Promise<SocketTicketClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: TICKET_ISSUER,
      audience: TICKET_AUDIENCE,
      algorithms: ["HS256"],
    })
    const playerId = payload.sub
    const roomCode = payload.roomCode
    if (typeof playerId !== "string" || typeof roomCode !== "string") {
      return null
    }

    const claims = { playerId, roomCode }
    validateClaims(claims)
    return claims
  } catch {
    return null
  }
}

function getSigningKey(): Uint8Array {
  const secret = process.env.SOCKET_TICKET_SECRET
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new SocketTicketConfigurationError()
  }
  return new TextEncoder().encode(secret)
}

function validateClaims(claims: SocketTicketClaims): void {
  if (
    !PLAYER_ID_PATTERN.test(claims.playerId) ||
    !ROOM_CODE_PATTERN.test(claims.roomCode)
  ) {
    throw new TypeError("Socket ticket claims are invalid.")
  }
}
