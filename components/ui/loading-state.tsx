import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface LoadingStateProps {
  label?: string
  className?: string
  fullHeight?: boolean
}

function LoadingState({
  label = "Caricamento",
  className,
  fullHeight = false,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground",
        fullHeight && "min-h-48",
        className
      )}
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-5 animate-spin text-brand-coral"
      />
      <span>{label}</span>
    </div>
  )
}

export { LoadingState }
