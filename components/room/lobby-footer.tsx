interface LobbyFooterProps {
  gameStarted: boolean
  actionError: string
}

function LobbyFooter({ gameStarted, actionError }: LobbyFooterProps) {
  return (
    <footer className="space-y-3 pb-5" aria-live="polite">
      {gameStarted && (
        <div
          className="border-l-4 border-brand-teal bg-brand-teal/10 p-4"
          role="status"
        >
          <p className="font-heading font-bold">Si parte!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            La partita è stata avviata. La schermata del gioco è il prossimo
            passaggio.
          </p>
        </div>
      )}
      {actionError && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          role="alert"
        >
          {actionError}
        </p>
      )}
    </footer>
  )
}

export { LobbyFooter }
