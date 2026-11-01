import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface ScoreBadgeProps {
  score: number
  label?: string
}

function ScoreBadge({ score, label = "punti" }: ScoreBadgeProps) {
  return (
    <Badge
      variant="accent"
      aria-label={`${score} ${label}`}
      className="gap-1.5 px-2.5 py-1.5"
    >
      <Star aria-hidden="true" className="fill-current" />
      <span>{score}</span>
    </Badge>
  )
}

export { ScoreBadge }
