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
    const isAbsurdMode = view.mode === "absurd_situations"
    const hasSubmittedVote = currentRound.hasSubmittedVote
    const selectionLimit = isAbsurdMode ? 1 : Number.POSITIVE_INFINITY

    function toggleAnswer(answerId: string) {
        const currentSelection = hasLocalSelection
            ? localSelection.answerIds
            : currentRound.selectedAnswerIds
        const answerIds = isAbsurdMode
            ? currentSelection.includes(answerId)
                ? []
                : [answerId]
            : currentSelection.includes(answerId)
                ? currentSelection.filter((selectedId) => selectedId !== answerId)
                : [...currentSelection, answerId]
        setLocalSelection({
            roundNumber: currentRound.number,
            phase: currentRound.phase,
            answerIds,
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
                            ? isAbsurdMode
                                ? "Quale risposta fa più ridere?"
                                : "Quale risposta ti somiglia di più?"
                            : isAbsurdMode
                                ? "Ecco le risposte"
                                : "Ecco le ipotesi"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isAbsurdMode
                            ? hasSubmittedVote
                                ? `Voto registrato. ${currentRound.voteCount} di ${currentRound.requiredVoteCount} voti raccolti.`
                                : canSelect
                                    ? `Scegli una risposta diversa dalla tua. Voti: ${currentRound.voteCount} di ${currentRound.requiredVoteCount}; i risultati restano segreti fino alla fine.`
                                    : `Votazione segreta: ${currentRound.voteCount} di ${currentRound.requiredVoteCount} voti raccolti.`
                            : canSelect
                                ? "Seleziona tutte le risposte che ti somigliano. Conferma quando hai finito; i nomi si scoprono dopo."
                                : `${protagonist?.nickname ?? "Il protagonista"} sta scegliendo la risposta più vicina.`}
                    </p>
                </div>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
                {view.currentRound.answers.map((answer, index) => {
                    const selected = selectedAnswerIds.includes(answer.id)
                    const isOwnAnswer = "isOwnAnswer" in answer && answer.isOwnAnswer
                    const answerIsSelectable =
                        canSelect && selectingPhase && !hasSubmittedVote && !isOwnAnswer
                    return (
                        <li key={answer.id}>
                            {answerIsSelectable ? (
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
                                    <span className="flex-1">
                                        {answer.content}
                                        {isAbsurdMode && isOwnAnswer && (
                                            <span className="mt-2 block text-xs font-semibold text-muted-foreground">
                                                La tua risposta
                                            </span>
                                        )}
                                    </span>
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

            {canSelect &&
                selectingPhase &&
                !hasSubmittedVote &&
                view.currentRound.answers.length > 0 && (
                    <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        isDisabled={
                            isSelecting ||
                            selectedAnswerIds.length === 0 ||
                            selectedAnswerIds.length > selectionLimit
                        }
                        onPress={() => void onSelect(selectedAnswerIds.slice(0, selectionLimit))}
                    >
                        {isSelecting
                            ? "Conferma in corso…"
                            : isAbsurdMode
                                ? "Invia voto"
                                : `Conferma ${selectedAnswerIds.length > 0 ? `(${selectedAnswerIds.length})` : "selezione"}`}
                        <Check aria-hidden="true" />
                    </Button>
                )}
        </section>
    )
}

export { AnswerReveal }
