import { ArrowRight, PartyPopper, Sparkles } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/ui/score-badge"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

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

interface RoundResultProps {
  view: PlayerGameView
  isHost: boolean
  isAdvancing: boolean
  onNext: () => Promise<void>
}

function RoundResult({ view, isHost, isAdvancing, onNext }: RoundResultProps) {
  const selected = view.currentRound.answers.find(
    (answer) => answer.id === view.currentRound.selectedAnswerId
  )
  const selectedPlayer = view.players.find(
    (player) => player.id === selected?.authorId
  )
  const protagonist = view.players.find(
    (player) => player.id === view.currentRound.protagonistId
  )
  const finalRound = view.currentRound.phase === "finished"

  if (finalRound) {
    const ranking = [...view.players].sort(
      (first, second) =>
        second.score - first.score ||
        first.nickname.localeCompare(second.nickname, "it")
    )
    return (
      <section className="space-y-5" aria-labelledby="game-finished-title">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
            <PartyPopper aria-hidden="true" className="size-7" />
          </span>
          <p className="mt-4 text-xs font-bold text-brand-coral uppercase">
            Partita conclusa
          </p>
          <h2
            id="game-finished-title"
            className="mt-1 font-heading text-3xl font-extrabold"
          >
            {ranking[0]?.nickname ?? "Grazie per aver giocato"}
          </h2>
          <p className="text-muted-foreground">ha conquistato il tavolo</p>
        </div>
        <ol className="divide-y divide-border border-y border-border">
          {ranking.map((player, index) => (
            <li key={player.id} className="flex items-center gap-3 py-3">
              <span className="w-6 font-mono text-sm font-bold text-muted-foreground">
                {index + 1}
              </span>
              <Avatar
                name={player.nickname}
                emoji={avatarEmoji[player.avatar ?? "sun"]}
                color={index === 0 ? "lemon" : "teal"}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {player.nickname}
              </span>
              <ScoreBadge score={player.score} />
            </li>
          ))}
        </ol>
      </section>
    )
  }

  return (
    <section className="space-y-5" aria-labelledby="round-result-title">
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
          <Sparkles aria-hidden="true" className="size-6" />
        </span>
        <p className="mt-3 text-xs font-bold text-brand-coral uppercase">
          Risultato del round
        </p>
        <h2
          id="round-result-title"
          className="mt-1 font-heading text-2xl font-extrabold"
        >
          {selectedPlayer
            ? `${selectedPlayer.nickname} ci ha preso!`
            : "Round completato"}
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">
            Risposta originale
          </p>
          <p className="mt-2 text-lg font-semibold">
            {view.currentRound.originalAnswer ?? "Nessuna risposta inviata"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {protagonist?.nickname}
          </p>
        </div>
        <div className="rounded-lg border border-brand-teal/35 bg-brand-teal/5 p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">
            Risposta scelta
          </p>
          <p className="mt-2 text-lg font-semibold">
            {selected?.content ?? "Nessuna risposta selezionata"}
          </p>
          {selectedPlayer && (
            <p className="mt-2 text-xs text-muted-foreground">
              Scritta da {selectedPlayer.nickname}
            </p>
          )}
        </div>
      </div>

      <ol className="divide-y divide-border border-y border-border">
        {[...view.players]
          .sort(
            (first, second) =>
              second.score - first.score ||
              first.nickname.localeCompare(second.nickname, "it")
          )
          .map((player, index) => (
            <li key={player.id} className="flex items-center gap-3 py-2.5">
              <span className="w-6 font-mono text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {player.nickname}
              </span>
              <ScoreBadge score={player.score} />
            </li>
          ))}
      </ol>

      {isHost ? (
        <Button
          className="w-full sm:w-auto"
          size="lg"
          onPress={() => void onNext()}
          isDisabled={isAdvancing}
        >
          {isAdvancing ? "Un attimo…" : "Prossimo round"}
          <ArrowRight aria-hidden="true" />
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          In attesa che l&apos;host continui.
        </p>
      )}
    </section>
  )
}

export { RoundResult }
