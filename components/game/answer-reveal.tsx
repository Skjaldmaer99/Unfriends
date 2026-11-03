"use client"

import { useState } from "react"
import { Check, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

interface AnswerRevealProps {
  view: PlayerGameView
  canSelect: boolean
  isSelecting: boolean
  onSelect: (answerIds: string[]) => Promise<void>
}

function AnswerReveal({
  view,
  canSelect,
  isSelecting,
  onSelect,
}: AnswerRevealProps) {
  const [localSelection, setLocalSelection] = useState<{
    roundNumber: number
    phase: PlayerGameView["currentRound"]["phase"]
    answerIds: string[]
  } | null>(null)
  const { currentRound } = view
  const hasLocalSelection =
    localSelection?.roundNumber === currentRound.number &&
    localSelection.phase === currentRound.phase
  const selectedAnswerIds = hasLocalSelection
    ? localSelection.answerIds
    : currentRound.selectedAnswerIds
  const protagonist = view.players.find(
    (player) => player.id === view.currentRound.protagonistId
  )
  const selectingPhase = view.currentRound.phase === "protagonist_selection"

  function toggleAnswer(answerId: string) {
    const currentSelection = hasLocalSelection
      ? localSelection.answerIds
      : currentRound.selectedAnswerIds
    setLocalSelection({
      roundNumber: currentRound.number,
      phase: currentRound.phase,
      answerIds: currentSelection.includes(answerId)
        ? currentSelection.filter((selectedId) => selectedId !== answerId)
        : [...currentSelection, answerId],
    })
  }

  return (
    <section className="space-y-4" aria-labelledby="reveal-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
          <Eye aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 id="reveal-title" className="font-heading text-xl font-bold">
            {selectingPhase
              ? "Quale risposta ti somiglia di più?"
              : "Ecco le ipotesi"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canSelect
              ? "Seleziona tutte le risposte che ti somigliano. Conferma quando hai finito; i nomi si scoprono dopo."
              : `${protagonist?.nickname ?? "Il protagonista"} sta scegliendo la risposta più vicina.`}
          </p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {view.currentRound.answers.map((answer, index) => {
          const selected = selectedAnswerIds.includes(answer.id)
          return (
            <li key={answer.id}>
              {canSelect && selectingPhase ? (
                <Button
                  className={`h-full min-h-24 w-full justify-start rounded-lg px-4 py-4 text-left text-base leading-relaxed whitespace-normal ${selected ? "border-brand-teal ring-2 ring-brand-teal/20" : ""}`}
                  variant={selected ? "secondary" : "outline"}
                  isDisabled={isSelecting}
                  aria-pressed={selected}
                  onPress={() => toggleAnswer(answer.id)}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lemon text-xs font-bold text-accent-foreground">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{answer.content}</span>
                  {selected && (
                    <Check aria-hidden="true" className="text-brand-teal" />
                  )}
                </Button>
              ) : (
                <div className="flex min-h-24 items-start gap-3 rounded-lg border border-border bg-card px-4 py-4 text-base leading-relaxed">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lemon text-xs font-bold text-accent-foreground">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{answer.content}</span>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {view.currentRound.answers.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Nessuna ipotesi è arrivata in tempo.
        </p>
      )}

      {canSelect && selectingPhase && view.currentRound.answers.length > 0 && (
        <Button
          size="lg"
          className="w-full sm:w-auto"
          isDisabled={isSelecting || selectedAnswerIds.length === 0}
          onPress={() => void onSelect(selectedAnswerIds)}
        >
          {isSelecting
            ? "Conferma in corso…"
            : `Conferma ${selectedAnswerIds.length > 0 ? `(${selectedAnswerIds.length})` : "selezione"}`}
          <Check aria-hidden="true" />
        </Button>
      )}
    </section>
  )
}

export { AnswerReveal }
