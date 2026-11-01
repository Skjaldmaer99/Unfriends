"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { z } from "zod"

import {
  GameSettingsSchema,
  type GameSettings,
  type PlayerGameView,
} from "@/realtime-server/src/game/types"
import type {
  ClientToServerEvents,
  EventFailure,
  GameSummary,
  RoomSnapshot,
  ServerToClientEvents,
} from "@/realtime-server/src/protocol"

const SocketTicketSchema = z.object({ ticket: z.string().min(1) })
const RoomSnapshotSchema = z.object({
  code: z.string(),
  status: z.enum(["waiting", "in_progress", "finished"]),
  maxPlayers: z.number(),
  playerCount: z.number(),
  settings: GameSettingsSchema,
  players: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      avatar: z.string(),
      isHost: z.boolean(),
      score: z.number(),
      connectionStatus: z.enum(["connected", "disconnected"]),
    })
  ),
})

export type LobbyRoom = RoomSnapshot & { selfPlayerId: string }
type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>

interface LobbyState {
  room: LobbyRoom | null
  readyByPlayerId: Record<string, boolean>
  isConnected: boolean
  isLoading: boolean
  isSavingSettings: boolean
  isStarting: boolean
  isLeaving: boolean
  gameStarted: boolean
  gameView: PlayerGameView | null
  gameSummary: GameSummary | null
  answerPhase: {
    phase: "protagonist_answer" | "players_answer" | "protagonist_selection"
    answerCount: number
    requiredAnswerCount: number
    deadlineAt: number | null
  } | null
  isSubmittingAnswer: boolean
  isSelectingAnswer: boolean
  isAdvancingRound: boolean
  isReplaying: boolean
  error: string
  actionError: string
}

const initialState: LobbyState = {
  room: null,
  readyByPlayerId: {},
  isConnected: false,
  isLoading: true,
  isSavingSettings: false,
  isStarting: false,
  isLeaving: false,
  gameStarted: false,
  gameView: null,
  gameSummary: null,
  answerPhase: null,
  isSubmittingAnswer: false,
  isSelectingAnswer: false,
  isAdvancingRound: false,
  isReplaying: false,
  error: "",
  actionError: "",
}

function errorMessage(error: EventFailure): string {
  const messages: Record<string, string> = {
    TOO_FEW_PLAYERS: "Servono almeno 3 giocatori connessi per iniziare.",
    HOST_REQUIRED: "Solo l'host può effettuare questa azione.",
    ROOM_UNAVAILABLE: "La stanza non è più in attesa di giocatori.",
    ROOM_NOT_FOUND: "La stanza non esiste più.",
    RATE_LIMITED: "Hai fatto troppe azioni. Attendi qualche secondo.",
  }
  return messages[error.code] ?? error.error
}

function getAnswerPhase(view: PlayerGameView): LobbyState["answerPhase"] {
  const phase = view.currentRound.phase
  if (
    phase !== "protagonist_answer" &&
    phase !== "players_answer" &&
    phase !== "protagonist_selection"
  ) {
    return null
  }

  return {
    phase,
    answerCount: view.currentRound.answerCount,
    requiredAnswerCount: view.currentRound.requiredAnswerCount,
    deadlineAt: view.currentRound.deadlineAt,
  }
}

export function useRoomLobby(code: string) {
  const [state, setState] = useState(initialState)
  const socketRef = useRef<LobbySocket | null>(null)

  useEffect(() => {
    let active = true
    let activeSocket: LobbySocket | null = null

    async function connectToRoom() {
      try {
        const roomResponse = await fetch(
          `/api/rooms/${encodeURIComponent(code)}`,
          {
            cache: "no-store",
          }
        )
        if (!roomResponse.ok) {
          throw new Error(
            roomResponse.status === 401
              ? "Questa sessione non appartiene alla stanza. Torna alla home e rientra con il codice."
              : "Non troviamo questa stanza. Controlla il codice e riprova."
          )
        }

        const roomResult: unknown = await roomResponse.json()
        const roomParsed = RoomSnapshotSchema.safeParse(roomResult)
        if (
          !roomParsed.success ||
          typeof roomResult !== "object" ||
          roomResult === null ||
          !("selfPlayerId" in roomResult) ||
          typeof roomResult.selfPlayerId !== "string"
        ) {
          throw new Error("Non siamo riusciti a leggere i dati della stanza.")
        }
        const initialRoom: LobbyRoom = {
          ...roomParsed.data,
          selfPlayerId: roomResult.selfPlayerId,
        }
        if (active) {
          setState((current) => ({
            ...current,
            room: initialRoom,
            isLoading: false,
            error: "",
          }))
        }

        const realtimeUrl =
          process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000"
        activeSocket = io(realtimeUrl, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5_000,
          auth: (callback) => {
            void fetch(`/api/rooms/${encodeURIComponent(code)}/socket-ticket`, {
              cache: "no-store",
            })
              .then(async (response) => {
                if (!response.ok)
                  throw new Error(
                    "Non possiamo autenticare la connessione live."
                  )
                const result: unknown = await response.json()
                const parsed = SocketTicketSchema.safeParse(result)
                if (!parsed.success)
                  throw new Error("Ticket realtime non valido.")
                callback({ ticket: parsed.data.ticket })
              })
              .catch((error: unknown) => {
                if (active) {
                  setState((current) => ({
                    ...current,
                    isConnected: false,
                    actionError:
                      error instanceof Error
                        ? error.message
                        : "Connessione live non disponibile.",
                  }))
                }
                callback({ ticket: "" })
              })
          },
        })
        socketRef.current = activeSocket
        activeSocket.on("connect", () => {
          if (active)
            setState((current) => ({
              ...current,
              isConnected: true,
              actionError: "",
            }))
        })
        activeSocket.on("disconnect", () => {
          if (active)
            setState((current) => ({ ...current, isConnected: false }))
        })
        activeSocket.on("connect_error", (connectionError) => {
          if (active) {
            setState((current) => ({
              ...current,
              isConnected: false,
              actionError:
                connectionError.message || "Connessione live interrotta.",
            }))
          }
        })
        activeSocket.on("room:joined", (snapshot) => {
          if (active) {
            setState((current) => ({
              ...current,
              room: {
                ...snapshot,
                selfPlayerId:
                  current.room?.selfPlayerId ?? initialRoom.selfPlayerId,
              },
              error: "",
            }))
          }
        })
        activeSocket.on("room:updated", (snapshot) => {
          if (active) {
            setState((current) => ({
              ...current,
              room: {
                ...snapshot,
                selfPlayerId:
                  current.room?.selfPlayerId ?? initialRoom.selfPlayerId,
              },
            }))
          }
        })
        activeSocket.on("room:ready-updated", (players) => {
          if (active) {
            setState((current) => ({
              ...current,
              readyByPlayerId: Object.fromEntries(
                players.map((player) => [player.id, player.ready])
              ),
            }))
          }
        })
        activeSocket.on("room:error", (serverError) => {
          if (active)
            setState((current) => ({
              ...current,
              actionError: errorMessage(serverError),
            }))
        })
        activeSocket.on("game:started", (view) => {
          if (active) {
            setState((current) => ({
              ...current,
              gameStarted: true,
              gameView: view,
              answerPhase: {
                phase: view.currentRound.phase as
                  | "protagonist_answer"
                  | "players_answer"
                  | "protagonist_selection",
                answerCount: view.currentRound.answerCount,
                requiredAnswerCount: view.currentRound.requiredAnswerCount,
                deadlineAt: view.currentRound.deadlineAt,
              },
            }))
          }
        })
        activeSocket.on("game:state", (view) => {
          if (active) {
            setState((current) => ({
              ...current,
              gameStarted: true,
              gameView: view,
              answerPhase: getAnswerPhase(view),
            }))
          }
        })
        activeSocket.on("round:started", (view) => {
          if (active) {
            setState((current) => ({
              ...current,
              gameStarted: true,
              gameView: view,
              answerPhase: {
                phase: view.currentRound.phase as
                  | "protagonist_answer"
                  | "players_answer"
                  | "protagonist_selection",
                answerCount: view.currentRound.answerCount,
                requiredAnswerCount: view.currentRound.requiredAnswerCount,
                deadlineAt: view.currentRound.deadlineAt,
              },
            }))
          }
        })
        activeSocket.on("round:answer-phase", (phase) => {
          if (active) {
            setState((current) => ({
              ...current,
              answerPhase: phase,
              gameView: current.gameView
                ? {
                    ...current.gameView,
                    currentRound: {
                      ...current.gameView.currentRound,
                      phase: phase.phase,
                      answerCount: phase.answerCount,
                      requiredAnswerCount: phase.requiredAnswerCount,
                      deadlineAt: phase.deadlineAt,
                    },
                  }
                : null,
            }))
          }
        })
        activeSocket.on("round:reveal", (view) => {
          if (active) {
            setState((current) => ({
              ...current,
              gameView: view,
              answerPhase: {
                phase: "protagonist_selection",
                answerCount: view.currentRound.answerCount,
                requiredAnswerCount: view.currentRound.requiredAnswerCount,
                deadlineAt: view.currentRound.deadlineAt,
              },
            }))
          }
        })
        activeSocket.on("round:completed", (view) => {
          if (active) setState((current) => ({ ...current, gameView: view }))
        })
        activeSocket.on("game:completed", (view) => {
          if (active)
            setState((current) => ({
              ...current,
              gameView: view,
              gameStarted: true,
            }))
        })
        activeSocket.on("score:updated", (scores) => {
          if (active) {
            const scoreById = new Map(
              scores.map((player) => [player.id, player.score])
            )
            setState((current) => ({
              ...current,
              room: current.room
                ? {
                    ...current.room,
                    players: current.room.players.map((player) => ({
                      ...player,
                      score: scoreById.get(player.id) ?? player.score,
                    })),
                  }
                : null,
              gameView: current.gameView
                ? {
                    ...current.gameView,
                    players: current.gameView.players.map((player) => ({
                      ...player,
                      score: scoreById.get(player.id) ?? player.score,
                    })),
                  }
                : null,
            }))
          }
        })
        activeSocket.on("game:summary", (summary) => {
          if (active) {
            setState((current) => ({ ...current, gameSummary: summary }))
          }
        })
        activeSocket.on("game:replayed", (snapshot) => {
          if (active) {
            setState((current) => ({
              ...current,
              room: {
                ...snapshot,
                selfPlayerId:
                  current.room?.selfPlayerId ?? initialRoom.selfPlayerId,
              },
              gameStarted: false,
              gameView: null,
              gameSummary: null,
              readyByPlayerId: {},
              actionError: "",
            }))
          }
        })
      } catch (loadError) {
        if (active) {
          setState((current) => ({
            ...current,
            isLoading: false,
            error:
              loadError instanceof Error
                ? loadError.message
                : "Connessione non disponibile. Riprova.",
          }))
        }
      }
    }

    void connectToRoom()
    return () => {
      active = false
      activeSocket?.disconnect()
      if (socketRef.current === activeSocket) socketRef.current = null
    }
  }, [code])

  function setReady(ready: boolean): Promise<void> {
    if (!socketRef.current?.connected || !state.room) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      socketRef.current?.emit("player:ready", { ready }, (result) => {
        if (!result.ok)
          setState((current) => ({
            ...current,
            actionError: errorMessage(result),
          }))
        resolve()
      })
    })
  }

  function saveSettings(settings: GameSettings): Promise<void> {
    const parsed = GameSettingsSchema.safeParse(settings)
    if (!parsed.success) {
      setState((current) => ({
        ...current,
        actionError: "Controlla le impostazioni selezionate.",
      }))
      return Promise.resolve()
    }
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }

    setState((current) => ({
      ...current,
      isSavingSettings: true,
      actionError: "",
    }))
    return new Promise((resolve) => {
      socketRef.current?.emit(
        "room:settings",
        { settings: parsed.data },
        (result) => {
          setState((current) => ({
            ...current,
            isSavingSettings: false,
            actionError: result.ok ? "" : errorMessage(result),
          }))
          resolve()
        }
      )
    })
  }

  function startGame(): Promise<void> {
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }

    setState((current) => ({ ...current, isStarting: true, actionError: "" }))
    return new Promise((resolve) => {
      socketRef.current?.emit("room:start", {}, (result) => {
        setState((current) => ({
          ...current,
          isStarting: false,
          actionError: result.ok ? "" : errorMessage(result),
        }))
        resolve()
      })
    })
  }

  function submitAnswer(content: string): Promise<void> {
    const normalized = content.trim()
    if (!normalized || normalized.length > 240) {
      setState((current) => ({
        ...current,
        actionError: "La risposta deve avere da 1 a 240 caratteri.",
      }))
      return Promise.resolve()
    }
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }

    setState((current) => ({
      ...current,
      isSubmittingAnswer: true,
      actionError: "",
    }))
    return new Promise((resolve) => {
      socketRef.current?.emit(
        "answer:submit",
        { content: normalized },
        (result) => {
          setState((current) => ({
            ...current,
            isSubmittingAnswer: false,
            actionError: result.ok ? "" : errorMessage(result),
            gameView:
              result.ok && current.gameView
                ? {
                    ...current.gameView,
                    currentRound: {
                      ...current.gameView.currentRound,
                      hasSubmittedAnswer: true,
                    },
                  }
                : current.gameView,
          }))
          resolve()
        }
      )
    })
  }

  function selectAnswer(answerId: string): Promise<void> {
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }
    setState((current) => ({
      ...current,
      isSelectingAnswer: true,
      actionError: "",
    }))
    return new Promise((resolve) => {
      socketRef.current?.emit("answer:select", { answerId }, (result) => {
        setState((current) => ({
          ...current,
          isSelectingAnswer: false,
          actionError: result.ok ? "" : errorMessage(result),
        }))
        resolve()
      })
    })
  }

  function advanceRound(): Promise<void> {
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }
    setState((current) => ({
      ...current,
      isAdvancingRound: true,
      actionError: "",
    }))
    return new Promise((resolve) => {
      socketRef.current?.emit("round:next", {}, (result) => {
        setState((current) => ({
          ...current,
          isAdvancingRound: false,
          actionError: result.ok ? "" : errorMessage(result),
        }))
        resolve()
      })
    })
  }

  function replayGame(): Promise<void> {
    if (!socketRef.current?.connected) {
      setState((current) => ({
        ...current,
        actionError: "Riconnessione al tavolo in corso…",
      }))
      return Promise.resolve()
    }

    setState((current) => ({ ...current, isReplaying: true, actionError: "" }))
    return new Promise((resolve) => {
      socketRef.current?.emit("game:replay", {}, (result) => {
        setState((current) => ({
          ...current,
          isReplaying: false,
          actionError: result.ok ? "" : errorMessage(result),
        }))
        resolve()
      })
    })
  }

  async function leaveRoom(): Promise<boolean> {
    setState((current) => ({ ...current, isLeaving: true, actionError: "" }))
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/leave`,
        {
          method: "POST",
        }
      )
      if (!response.ok) {
        setState((current) => ({
          ...current,
          isLeaving: false,
          actionError: "Non siamo riusciti a lasciare la stanza.",
        }))
        return false
      }
      socketRef.current?.disconnect()
      return true
    } catch {
      setState((current) => ({
        ...current,
        isLeaving: false,
        actionError: "Connessione non disponibile. Riprova.",
      }))
      return false
    }
  }

  const selfReady = state.room
    ? (state.readyByPlayerId[state.room.selfPlayerId] ?? false)
    : false

  return {
    ...state,
    selfReady,
    setReady,
    saveSettings,
    startGame,
    submitAnswer,
    selectAnswer,
    advanceRound,
    replayGame,
    leaveRoom,
  }
}
