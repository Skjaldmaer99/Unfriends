"use client"

import { useState, type FormEvent } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AnswerFormProps {
    isProtagonist: boolean
    isAbsurdMode: boolean
    isSubmitting: boolean
    onSubmit: (answer: string) => Promise<void>
}

const MAX_ANSWER_LENGTH = 240

function AnswerForm({
    isProtagonist,
    isAbsurdMode,
    isSubmitting,
    onSubmit,
}: AnswerFormProps) {
    const [answer, setAnswer] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const normalized = answer.trim()
        if (!normalized) {
            setError("Scrivi una risposta prima di inviarla.")
            return
        }
        if (normalized.length > MAX_ANSWER_LENGTH) {
            setError(`La risposta non può superare ${MAX_ANSWER_LENGTH} caratteri.`)
            return
        }

        setError("")
        await onSubmit(normalized)
    }

    return (
        <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm font-semibold">
                {isAbsurdMode
                    ? "La tua risposta"
                    : isProtagonist
                        ? "La tua risposta, solo per te"
                        : "La tua ipotesi"}
                <textarea
                    autoFocus
                    className="min-h-32 w-full resize-y rounded-lg border border-input bg-card px-3 py-3 text-base leading-relaxed transition outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-60"
                    disabled={isSubmitting}
                    maxLength={MAX_ANSWER_LENGTH}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={
                        isAbsurdMode
                            ? "Scrivi la risposta più assurda che ti viene in mente…"
                            : isProtagonist
                                ? "Scrivi quello che ti viene in mente…"
                                : "Cosa risponderebbe il protagonista?"
                    }
                    value={answer}
                />
                <span className="block text-right text-xs font-normal text-muted-foreground">
                    {answer.length}/{MAX_ANSWER_LENGTH}
                </span>
            </label>
            {error && (
                <p className="text-sm font-medium text-destructive" role="alert">
                    {error}
                </p>
            )}
            <Button
                className="w-full sm:w-auto"
                type="submit"
                size="lg"
                isDisabled={isSubmitting || !answer.trim()}
            >
                <Send aria-hidden="true" />
                {isSubmitting ? "Invio…" : "Invia risposta"}
            </Button>
        </form>
    )
}

export { AnswerForm }
