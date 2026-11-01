import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number
  max?: number
  label: string
  className?: string
  indicatorClassName?: string
}

function Progress({
  value,
  max = 100,
  label,
  className,
  indicatorClassName,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const safeValue = Math.min(safeMax, Math.max(0, value))
  const percentage = (safeValue / safeMax) * 100

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand-teal transition-[width] duration-300 ease-out",
          indicatorClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export { Progress }
