import { NextResponse } from "next/server"

import { RoomCodeSchema } from "@/lib/room-input"
import {
    clearPlayerSessionCookie,
    getPlayerSessionHash,
} from "@/lib/player-session"
import {
    invalidRequest,
    rejectCrossOriginRequest,
    roomErrorResponse,
} from "@/lib/room-http"
import { leaveRoom } from "@/lib/room-service"

export const runtime = "nodejs"

interface LeaveRoomRouteContext {
    params: Promise<{ code: string }>
}

export async function POST(_request: Request, context: LeaveRoomRouteContext) {
    const originFailure = rejectCrossOriginRequest(_request)
    if (originFailure) return originFailure

    const { code: rawCode } = await context.params
    const parsedCode = RoomCodeSchema.safeParse(rawCode)
    if (!parsedCode.success) {
        return invalidRequest("Room code must contain six valid characters.")
    }

    const sessionTokenHash = await getPlayerSessionHash()
    if (!sessionTokenHash) {
        return Response.json(
            { error: "A player session is required." },
            { status: 401 }
        )
    }

    try {
        const result = await leaveRoom(parsedCode.data, sessionTokenHash)
        const response = NextResponse.json(result)
        clearPlayerSessionCookie(response)
        return response
    } catch (error) {
        return roomErrorResponse(error)
    }
}
