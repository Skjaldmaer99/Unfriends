"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Copy, DoorOpen, UsersRound } from "lucide-react"
import { z } from "zod"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { toast } from "@/components/ui/sonner"

const RoomSnapshotSchema = z.object({
  code: z.string(),
  status: z.enum(["waiting", "in_progress", "finished"]),
  maxPlayers: z.number(),
  playerCount: z.number(),
  selfPlayerId: z.string(),
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

type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>

const avatarEmoji: Record<string, string> = {
  sun: "☀️",
  sparkle: "✨",
  flower: "🌼",
  leaf: "🍃",
  moon: "🌙",
  star: "⭐",
  cherry: "🍒",
  wave: "🌊",
}

function RoomLanding({ code }: { code: string }) {
  const router = useRouter()
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadRoom() {
      try {
        const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
          cache: "no-store",
        })
        if (!response.ok) {
          const message =
            response.status === 401
              ? "Questa sessione non appartiene alla stanza. Torna alla home e rientra con il codice."
              : "Non troviamo questa stanza. Controlla il codice e riprova."
          throw new Error(message)
        }

        const parsed = RoomSnapshotSchema.safeParse(await response.json())
        if (!parsed.success) {
          throw new Error("Non siamo riusciti a leggere i dati della stanza.")
        }
        if (active) setRoom(parsed.data)
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Connessione non disponibile. Riprova."
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadRoom()
    return () => {
      active = false
    }
  }, [code])

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Codice copiato")
    } catch {
      toast.error("Non siamo riusciti a copiare il codice")
    }
  }

  async function leaveRoom() {
    setLeaving(true)
    try {
      await fetch(`/api/rooms/${encodeURIComponent(code)}/leave`, {
        method: "POST",
      })
      router.push("/")
    } catch {
      toast.error("Non siamo riusciti a lasciare la stanza")
      setLeaving(false)
    }
  }

  if (loading) {
    return <LoadingState label="Prepariamo il tavolo…" fullHeight />
  }

  if (error || !room) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-5 py-10">
        <p className="text-xs font-bold text-brand-coral uppercase">
          Stanza non disponibile
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold">
          Non troviamo il tavolo
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {error || "La stanza potrebbe essere stata chiusa."}
        </p>
        <Button className="mt-6 w-fit" onPress={() => router.push("/")}>
          <ArrowLeft aria-hidden="true" />
          Torna alla home
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-svh px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 font-heading font-bold"
            href="/"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-brand-coral text-primary-foreground">
              <DoorOpen aria-hidden="true" className="size-5" />
            </span>
            Chi mi conosce davvero?
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onPress={leaveRoom}
            isDisabled={leaving}
          >
            <ArrowLeft aria-hidden="true" />
            Esci
          </Button>
        </header>

        <section className="mt-10 border-b border-border pb-7 sm:mt-16 sm:pb-9">
          <p className="text-xs font-bold text-brand-teal uppercase">
            La stanza è pronta
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
                Il vostro tavolo
              </h1>
              <p className="mt-2 text-muted-foreground">
                Aspetta che gli amici raggiungano la stanza.
              </p>
            </div>
            <Button
              className="font-mono text-lg tracking-[0.12em]"
              variant="secondary"
              onPress={copyRoomCode}
              aria-label={`Copia codice stanza ${room.code}`}
            >
              {room.code}
              <Copy aria-hidden="true" />
            </Button>
          </div>
        </section>

        <section className="py-7 sm:py-9" aria-labelledby="players-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="players-title" className="font-heading text-xl font-bold">
              Al tavolo
            </h2>
            <Badge variant="secondary">
              <UsersRound aria-hidden="true" />
              {room.playerCount}/{room.maxPlayers}
            </Badge>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {room.players.map((player) => (
              <li
                key={player.id}
                className="flex min-w-0 items-center gap-3 border-b border-border bg-card/70 p-3"
              >
                <Avatar
                  name={player.nickname}
                  emoji={avatarEmoji[player.avatar]}
                  color={player.isHost ? "lemon" : "teal"}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{player.nickname}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.isHost
                      ? "Host"
                      : player.id === room.selfPlayerId
                        ? "Tu"
                        : "Giocatore"}
                  </p>
                </div>
                <span
                  aria-label={
                    player.connectionStatus === "connected"
                      ? "Connesso"
                      : "Disconnesso"
                  }
                  className={`size-2 rounded-full ${player.connectionStatus === "connected" ? "bg-brand-teal" : "bg-muted-foreground"}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-start gap-3 border-l-4 border-brand-lemon bg-brand-lemon/15 p-4 text-sm leading-relaxed">
          <span aria-hidden="true" className="text-lg">
            💌
          </span>
          <p>
            Condividi il codice con gli amici. Gli aggiornamenti live della
            lobby arrivano nella prossima fase.
          </p>
        </div>
      </div>
    </main>
  )
}

export { RoomLanding }
