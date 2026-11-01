import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export const PLAYER_SESSION_COOKIE = "unfriends_player_session"
export const PLAYER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/

export function createPlayerSessionToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashPlayerSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function getPlayerSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(PLAYER_SESSION_COOKIE)?.value
  if (!token || !sessionTokenPattern.test(token)) {
    return null
  }

  return hashPlayerSessionToken(token)
}

export function setPlayerSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: PLAYER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_SESSION_MAX_AGE_SECONDS,
  })
}

export function clearPlayerSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: PLAYER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
