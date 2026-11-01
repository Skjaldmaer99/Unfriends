import { Check, Copy, Share2, UsersRound, Wifi, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface RoomCodeCardProps {
  code: string
  playerCount: number
  connectedCount: number
  maxPlayers: number
  isConnected: boolean
  copied: boolean
  status: "waiting" | "in_progress" | "finished"
  onCopy: () => void
  onShare: () => void
}

function RoomCodeCard({
  code,
  playerCount,
  connectedCount,
  maxPlayers,
  isConnected,
  copied,
  status,
  onCopy,
  onShare,
}: RoomCodeCardProps) {
  return (
    <section className="mt-9 border-b border-border pb-7 sm:mt-14 sm:pb-9">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isConnected ? "success" : "destructive"}>
          {isConnected ? (
            <Wifi aria-hidden="true" />
          ) : (
            <WifiOff aria-hidden="true" />
          )}
          {isConnected ? "Live" : "Riconnessione…"}
        </Badge>
        {status !== "waiting" && (
          <Badge variant="accent">Partita in corso</Badge>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold text-brand-teal uppercase">
            La stanza è pronta
          </p>
          <h1 className="mt-1 font-heading text-4xl font-extrabold sm:text-5xl">
            Il vostro tavolo
          </h1>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            className="font-mono text-lg tracking-[0.12em]"
            variant="secondary"
            onPress={onCopy}
            aria-label={`Copia codice stanza ${code}`}
          >
            {code}
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
          </Button>
          <Button variant="outline" onPress={onShare}>
            <Share2 aria-hidden="true" />
            Condividi
          </Button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        <UsersRound aria-hidden="true" className="mr-1 inline size-4" />
        In stanza: {playerCount} di {maxPlayers} · Connessi: {connectedCount}
      </p>
    </section>
  )
}

export { RoomCodeCard }
