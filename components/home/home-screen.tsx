"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  Copy,
  DoorOpen,
  HeartHandshake,
  Plus,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { Avatar } from "@/components/ui/avatar"

const playerDetailsSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "Scrivi un nickname.")
    .max(24, "Massimo 24 caratteri."),
  avatar: z.enum([
    "sun",
    "sparkle",
    "flower",
    "leaf",
    "moon",
    "star",
    "cherry",
    "wave",
  ]),
})

const createRoomSchema = z.object({
  code: z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/),
})

const avatarOptions = [
  { id: "sun", emoji: "☀️", name: "Sole" },
  { id: "sparkle", emoji: "✨", name: "Scintilla" },
  { id: "flower", emoji: "🌼", name: "Fiore" },
  { id: "leaf", emoji: "🍃", name: "Foglia" },
  { id: "moon", emoji: "🌙", name: "Luna" },
  { id: "star", emoji: "⭐", name: "Stella" },
  { id: "cherry", emoji: "🍒", name: "Ciliegia" },
  { id: "wave", emoji: "🌊", name: "Onda" },
] as const

type AvatarId = (typeof avatarOptions)[number]["id"]
type DialogMode = "create" | "join"

interface RoomResponse {
  code: string
  playerId: string
}

interface ApiErrorResponse {
  code?: string
  error?: string
}

const roomErrorMessages: Record<string, string> = {
  ROOM_NOT_FOUND: "Non troviamo una stanza con questo codice.",
  ROOM_UNAVAILABLE:
    "Questa partita è già iniziata o non accetta altri giocatori.",
  ROOM_FULL: "La stanza ha già raggiunto il limite di giocatori.",
  NICKNAME_TAKEN: "Questo nickname è già stato scelto nella stanza.",
}

async function readApiError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (typeof body !== "object" || body === null || !("code" in body)) {
    return "Non siamo riusciti a completare la richiesta. Riprova tra poco."
  }

  const apiError = body as ApiErrorResponse
  if (apiError.code && roomErrorMessages[apiError.code]) {
    return roomErrorMessages[apiError.code]
  }
  return (
    apiError.error ??
    "Non siamo riusciti a completare la richiesta. Riprova tra poco."
  )
}

function AvatarPicker({
  value,
  onChange,
}: {
  value: AvatarId
  onChange: (avatar: AvatarId) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Scegli il tuo simbolo</legend>
      <div className="grid grid-cols-4 gap-2">
        {avatarOptions.map((avatar, index) => (
          <button
            key={avatar.id}
            type="button"
            aria-label={avatar.name}
            aria-pressed={value === avatar.id}
            onClick={() => onChange(avatar.id)}
            className={`grid min-h-14 place-items-center rounded-lg border text-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              value === avatar.id
                ? "border-brand-coral bg-brand-coral/10 shadow-[0_2px_0_var(--brand-coral)]"
                : "border-border bg-background hover:bg-muted"
            } ${index === 0 ? "text-brand-coral" : ""}`}
          >
            <span aria-hidden="true">{avatar.emoji}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function PlayerFields({
  nickname,
  setNickname,
  avatar,
  setAvatar,
  disabled,
}: {
  nickname: string
  setNickname: (value: string) => void
  avatar: AvatarId
  setAvatar: (value: AvatarId) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold">
        Come ti chiami?
        <Input
          autoComplete="nickname"
          autoFocus
          maxLength={24}
          name="nickname"
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Il tuo nickname"
          required
          value={nickname}
          disabled={disabled}
        />
        <span className="block text-right text-xs font-normal text-muted-foreground">
          {nickname.length}/24
        </span>
      </label>
      <AvatarPicker value={avatar} onChange={setAvatar} />
    </div>
  )
}

function RoomDialog({
  mode,
  onNavigate,
}: {
  mode: DialogMode
  onNavigate: (path: string) => void
}) {
  const [nickname, setNickname] = useState("")
  const [avatar, setAvatar] = useState<AvatarId>("sun")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const player = playerDetailsSchema.safeParse({ nickname, avatar })
    if (!player.success) {
      setError(player.error.issues[0]?.message ?? "Controlla i dati inseriti.")
      return
    }

    const normalizedCode = code.trim().toUpperCase()
    if (mode === "join" && !/^[A-HJ-NP-Z2-9]{6}$/.test(normalizedCode)) {
      setError("Il codice stanza è composto da 6 caratteri.")
      return
    }

    setPending(true)
    try {
      const endpoint =
        mode === "create"
          ? "/api/rooms"
          : `/api/rooms/${encodeURIComponent(normalizedCode)}/join`
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...player.data,
          ...(mode === "join" ? { code: normalizedCode } : {}),
        }),
      })

      if (!response.ok) {
        setError(await readApiError(response))
        return
      }

      const result: unknown = await response.json()
      const parsed = createRoomSchema.safeParse(
        typeof result === "object" && result !== null && "code" in result
          ? { code: result.code }
          : null
      )
      if (!parsed.success) {
        setError(
          "La stanza è stata creata, ma non abbiamo ricevuto un codice valido."
        )
        return
      }

      const room = result as RoomResponse
      onNavigate(`/room/${room.code}`)
    } catch {
      setError("Connessione non disponibile. Controlla la rete e riprova.")
    } finally {
      setPending(false)
    }
  }

  const isCreate = mode === "create"

  return (
    <DialogTrigger>
      <Button
        className="w-full justify-between sm:w-auto"
        size="lg"
        variant={isCreate ? "default" : "outline"}
      >
        <span className="inline-flex items-center gap-2">
          {isCreate ? (
            <Plus aria-hidden="true" />
          ) : (
            <DoorOpen aria-hidden="true" />
          )}
          {isCreate ? "Crea una partita" : "Entra con un codice"}
        </span>
        <ArrowRight aria-hidden="true" className="ml-4" />
      </Button>
      <DialogContent>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <DialogTitle>
              {isCreate ? "Apri il tavolo" : "Raggiungi il gruppo"}
            </DialogTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isCreate
                ? "Scegli come apparirai agli amici. Il codice arriva tra un attimo."
                : "Inserisci il codice che ti ha passato chi ha creato la partita."}
            </p>
          </div>
          <Button
            aria-label="Chiudi"
            className="-mt-2 -mr-2 shrink-0"
            slot="close"
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isCreate && (
            <label className="block space-y-2 text-sm font-semibold">
              Codice della stanza
              <Input
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={6}
                name="room-code"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ES. MELA42"
                required
                value={code}
                disabled={pending}
                className="font-mono text-lg tracking-[0.12em]"
              />
            </label>
          )}
          <PlayerFields
            nickname={nickname}
            setNickname={setNickname}
            avatar={avatar}
            setAvatar={setAvatar}
            disabled={pending}
          />
          {error && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button
            className="w-full"
            type="submit"
            size="lg"
            isDisabled={pending}
          >
            {pending ? (
              <LoadingState
                label="Un momento…"
                className="text-primary-foreground"
              />
            ) : isCreate ? (
              "Crea la stanza"
            ) : (
              "Entra nella partita"
            )}
          </Button>
        </form>
      </DialogContent>
    </DialogTrigger>
  )
}

function HomeScreen() {
  const router = useRouter()

  return (
    <main className="min-h-svh overflow-hidden px-4 pt-5 pb-10 sm:px-8 sm:pt-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link
            aria-label="Chi mi conosce davvero? Home"
            className="inline-flex items-center gap-2"
            href="/"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand-coral text-primary-foreground shadow-[0_3px_0_color-mix(in_oklch,var(--brand-coral),black_18%)]">
              <HeartHandshake aria-hidden="true" className="size-5" />
            </span>
            <span className="font-heading text-sm font-bold sm:text-base">
              CHI MI CONOSCE DAVVERO?
            </span>
          </Link>
          <span className="hidden items-center gap-2 text-sm font-semibold text-muted-foreground sm:inline-flex">
            <span className="size-2 rounded-full bg-brand-teal" />
            Si gioca in compagnia
          </span>
        </header>

        <section className="grid min-h-[calc(100svh-5.5rem)] items-center gap-8 pt-8 pb-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-14">
          <div className="animate-reveal-up max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-3 py-1.5 text-xs font-bold text-foreground uppercase">
              <Sparkles aria-hidden="true" className="size-4 text-brand-teal" />
              Il gioco delle vostre inside joke
            </div>
            <h1 className="max-w-[13ch] font-heading text-[clamp(3.2rem,8vw,6.6rem)] leading-[0.9] font-extrabold tracking-normal text-foreground">
              Chi mi conosce <span className="text-brand-coral">davvero?</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Una domanda su di te. Le risposte di tutti. Vediamo chi ci prende.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <RoomDialog
                mode="create"
                onNavigate={(path) => router.push(path)}
              />
              <RoomDialog
                mode="join"
                onNavigate={(path) => router.push(path)}
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Niente account. Ti basta un nickname e la tua compagnia.
            </p>
          </div>

          <div
            className="animate-reveal-up relative mx-auto w-full max-w-[34rem] lg:justify-self-end"
            style={{ animationDelay: "100ms" }}
          >
            <div className="relative rotate-[-2deg] rounded-2xl border border-border bg-card p-4 shadow-[0_8px_0_color-mix(in_oklch,var(--foreground)_12%,transparent)] sm:p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <span className="text-xs font-bold text-brand-teal uppercase">
                    Round 02
                  </span>
                  <h2 className="mt-1 font-heading text-lg font-bold">
                    Domanda per Giulia
                  </h2>
                </div>
                <span className="rounded-full bg-brand-lemon px-3 py-1 text-xs font-bold text-foreground">
                  01:24
                </span>
              </div>
              <p className="py-5 font-heading text-xl leading-snug font-bold sm:text-2xl">
                Qual è la sua idea di domenica perfetta?
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-xl border border-brand-coral/30 bg-brand-coral/5 p-3">
                  <Avatar name="Marta" emoji="🌼" color="lemon" />
                  <span className="text-sm font-medium">
                    Pranzo lungo e zero programmi
                  </span>
                  <Check
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0 text-brand-teal"
                  />
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                  <Avatar name="Nico" emoji="🌊" color="sky" />
                  <span className="text-sm font-medium">
                    Una gita improvvisata al mare
                  </span>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UsersRound aria-hidden="true" className="size-4" /> 5 amici
                  al tavolo
                </span>
                <span>La risposta resta segreta</span>
              </div>
            </div>
            <div className="relative mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
              <ArrowDownRight
                aria-hidden="true"
                className="size-4 text-brand-coral"
              />
              Le risposte fanno il giro. Le risate pure.
            </div>
          </div>
        </section>

        <section
          aria-labelledby="how-title"
          className="border-t border-border py-8 sm:py-10"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-brand-coral uppercase">
                In tre mosse
              </p>
              <h2
                id="how-title"
                className="mt-1 font-heading text-2xl font-bold"
              >
                Come si gioca
              </h2>
            </div>
            <Copy className="mb-1 size-5 text-brand-teal" aria-hidden="true" />
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Create il tavolo",
                detail: "Una persona apre la stanza e condivide il codice.",
              },
              {
                step: "02",
                title: "Rispondete di getto",
                detail: "A turno, gli amici provano a indovinare la risposta.",
              },
              {
                step: "03",
                title: "Scoprite chi ci prende",
                detail: "Il protagonista sceglie. I punti fanno il resto.",
              },
            ].map((item) => (
              <li
                key={item.step}
                className="rounded-xl border border-border bg-card/80 p-4"
              >
                <span className="font-mono text-xs font-bold text-brand-coral">
                  {item.step}
                </span>
                <h3 className="mt-2 font-heading font-bold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  )
}

export { HomeScreen }
