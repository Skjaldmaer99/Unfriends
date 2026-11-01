import { Check, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

interface AnswerRevealProps {
  view: PlayerGameView
  isSelecting: boolean
  onSelect: (answerId: string) => Promise<void>
}

function AnswerReveal({ view, isSelecting, onSelect }: AnswerRevealProps) {
  const protagonist = view.players.find(
    (player) => player.id === view.currentRound.protagonistId
  )
  const canSelect = protagonist?.isProtagonist ?? false
  const selectingPhase = view.currentRound.phase === "protagonist_selection"

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
              ? "Scegline una. I nomi si scoprono dopo."
              : `${protagonist?.nickname ?? "Il protagonista"} sta scegliendo la risposta più vicina.`}
          </p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {view.currentRound.answers.map((answer, index) => {
          const selected = view.currentRound.selectedAnswerId === answer.id
          return (
            <li key={answer.id}>
              <Button
                className={`h-full min-h-24 w-full justify-start rounded-lg px-4 py-4 text-left text-base leading-relaxed whitespace-normal ${selected ? "border-brand-teal ring-2 ring-brand-teal/20" : ""}`}
                variant={selected ? "secondary" : "outline"}
                isDisabled={!canSelect || !selectingPhase || isSelecting}
                onPress={() => void onSelect(answer.id)}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lemon text-xs font-bold text-accent-foreground">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1">{answer.content}</span>
                {selected && (
                  <Check aria-hidden="true" className="text-brand-teal" />
                )}
              </Button>
            </li>
          )
        })}
      </ul>

      {view.currentRound.answers.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Nessuna ipotesi è arrivata in tempo.
        </p>
      )}
    </section>
  )
}

export { AnswerReveal }
