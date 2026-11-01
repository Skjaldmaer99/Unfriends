"use client"

import { useEffect, useState } from "react"
import { Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface TimerProps {
  deadlineAt: number
  onExpire?: () => void
  className?: string
}

function Timer({ deadlineAt, onExpire, className }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    let hasExpired = false

    function updateTimer() {
      const nextSeconds = Math.max(
        0,
        Math.ceil((deadlineAt - Date.now()) / 1000)
      )
      setSecondsLeft(nextSeconds)
      if (nextSeconds === 0 && !hasExpired) {
        hasExpired = true
        onExpire?.()
      }
    }

    updateTimer()
    const intervalId = window.setInterval(updateTimer, 250)
    return () => window.clearInterval(intervalId)
  }, [deadlineAt, onExpire])

  const isUrgent = secondsLeft !== null && secondsLeft <= 10
  const display =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`

  return (
    <Badge
      variant={isUrgent ? "destructive" : "secondary"}
      className={className}
      role="timer"
      aria-label={
        secondsLeft === null
          ? "Timer in caricamento"
          : `${secondsLeft} secondi rimanenti`
      }
      aria-live="off"
    >
      <Clock3 aria-hidden="true" />
      <span>{display}</span>
    </Badge>
  )
}

export { Timer }
