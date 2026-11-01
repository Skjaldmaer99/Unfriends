# Chi mi conosce davvero?

## Descrizione

Party game multiplayer per gruppi di amici: a ogni turno un protagonista risponde in privato a una domanda personale; gli altri provano a indovinare la sua risposta. La partita si svolge in stanze private accessibili tramite codice e non richiede account.

## Stack tecnologico

| Area        | Scelta                                                | Stato nel repository                                        |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| Frontend    | Next.js App Router, React, TypeScript                 | Presente (Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3)   |
| UI          | Tailwind CSS 4, shadcn/ui, Lucide React               | Presente                                                    |
| API HTTP    | Next.js Route Handlers                                | Next.js presente; endpoint da implementare                  |
| Realtime    | Node.js, TypeScript, Socket.IO                        | Dipendenze configurate nel workspace `realtime-server/`     |
| Validazione | Zod                                                   | Installato nell'app e nel workspace realtime                |
| Persistenza | PostgreSQL, Drizzle ORM e Drizzle Kit                 | Dipendenze installate; schema e connessione da implementare |
| Test        | Da scegliere in Task 13 in base ai confini dei moduli | Da implementare                                             |

Il progetto esistente è un'app Next.js alla radice del repository, non un monorepo. Per l'MVP manterremo questa app alla radice e aggiungeremo un servizio `realtime-server/`; estrarre il frontend in `frontend/` non offre un vantaggio immediato e comporterebbe spostamenti non necessari. I contratti condivisi saranno isolati in `packages/shared/` quando verranno introdotti.

## Architettura generale

- **Frontend:** App Router per pagine, layout e interazioni; componenti UI e logica client separati.
- **Backend HTTP:** Route Handlers sotto `app/api/` per operazioni persistenti e richieste non realtime.
- **Realtime server:** processo Node separato con Socket.IO, fonte autorevole per lobby, transizioni di gioco, visibilità delle risposte e punteggi.
- **Database:** PostgreSQL con Drizzle per stanze, giocatori, domande e storico dei round/risposte/voti.
- **Sessione:** token casuale non basato sul nickname, conservato in modo sicuro dal client e verificato dal server; i payload realtime non sceglieranno l'identità del giocatore.
- **Deployment previsto:** app Next.js su Vercel, realtime server su Render, PostgreSQL presso un provider compatibile.

Le connessioni Socket.IO e lo stato di partita in memoria non devono essere accoppiati al processo Next.js: il server realtime è un servizio dedicato. Per la prima distribuzione su Render si dovrà mantenere una singola istanza realtime, oppure introdurre un adapter e una strategia di stato condiviso prima di scalare a più istanze. Le API Route Handler restano adatte alle operazioni HTTP, ma non sostituiscono il canale Socket.IO.

## Struttura

### Stato attuale

```text
app/                 App Router, pagina iniziale e CSS globale
components/          Provider tema e componenti UI
hooks/               Hook condivisi
lib/                 Utility condivise
public/              Asset statici
```

### Struttura prevista per l'MVP

```text
app/                 Frontend Next.js e Route Handlers
components/
  ui/                Primitive UI
  lobby/             Componenti della lobby
  game/              Componenti della partita
  shared/            Componenti condivisi
hooks/               Hook React, incluso il collegamento al realtime
lib/                 Utility frontend condivise
realtime-server/
  src/               Server Socket.IO, eventi, stanze e logica di gioco
packages/shared/
  src/               Tipi e schemi condivisi tra frontend e realtime
db/                  Schema Drizzle, migrazioni e seed
PROJECT.md           Architettura, avanzamento e istruzioni
```

La struttura effettiva potrà essere adattata mantenendo separati UI, logica di dominio, API, realtime e accesso ai dati.

## Funzionalità MVP previste

- Creazione e accesso a stanze private con codice, nickname e avatar.
- Lobby realtime con host, presenza, impostazioni e avvio con almeno 3 giocatori (massimo 8).
- Round con risposta originale privata, risposte anonime, scelta del protagonista, rivelazione e punteggio server-authoritative.
- Rotazione dei protagonisti, timer, riconnessione e conclusione della partita.
- Domande seed non offensive e non eccessivamente invasive.
- Layout responsive per desktop e smartphone.

Le modalità aggiuntive, i profili, gli amici e le classifiche globali restano fuori dall'MVP (Task 15).

## Avanzamento

| Task                          | Stato                   | Note                                                                               |
| ----------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| 0. Analisi e organizzazione   | Completata              | Repository e dipendenze verificati; architettura e questo documento definiti.      |
| 1. Configurazione stack       | Completata              | Dipendenze installate; `realtime-server/` configurato come workspace npm separato. |
| 2. Regole di gameplay         | Da iniziare             | Definire e testare il dominio prima dell'interfaccia.                              |
| 3. Database e dati            | Da iniziare             | Schema, migrazioni e seed.                                                         |
| 4. Gestione stanze            | Da iniziare             | Creazione, ingresso, uscita e lobby.                                               |
| 5. Server Socket.IO           | Da iniziare             | Stato autorevole, eventi validati e privacy.                                       |
| 6. Design system              | Da iniziare             | Estensione coerente dell'attuale base shadcn.                                      |
| 7. Pagina home                | Da iniziare             | Creazione/accesso alla partita.                                                    |
| 8. Lobby multiplayer          | Da iniziare             | Presenza e controlli host realtime.                                                |
| 9. Partita                    | Da iniziare             | Flusso completo dei round.                                                         |
| 10. Classifica e fine partita | Da iniziare             | Punteggi, risultato e replay.                                                      |
| 11. Stato e sessioni          | Da iniziare             | Riconnessione e separazione stato server/UI.                                       |
| 12. Sicurezza e validazione   | Da iniziare             | Schemi, permessi, rate limit e sessioni.                                           |
| 13. Testing                   | Da iniziare             | Test unitari, realtime e partita completa.                                         |
| 14. Deployment                | Da iniziare             | Vercel, Render e PostgreSQL.                                                       |
| 15. Funzionalità future       | Non pianificata per MVP | Architettura estendibile senza implementare queste feature ora.                    |

## Avvio locale

Prerequisiti attuali: Node.js compatibile con Next.js 16 e npm.

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`. Per i controlli disponibili:

```bash
npm run typecheck
npm run lint
npm run build
```

Il template attuale non richiede variabili d'ambiente per partire. Le istruzioni per PostgreSQL, migrazioni, seed e server realtime verranno aggiunte quando saranno implementati i rispettivi servizi; nessuna credenziale reale va inserita nel repository.

## Decisioni e verifiche iniziali

- La versione installata è Next.js 16.4.3 con App Router; le convenzioni sono state verificate nella documentazione installata in `node_modules/next/dist/docs/`.
- Route Handlers sono previsti nell'App Router; il server Socket.IO sarà separato e non verrà avviato tramite un custom server Next.js.
- Il repository contiene già Tailwind CSS 4, shadcn/ui, Lucide React, `next-themes` e React Aria Components.
- Configurazione Task 1: installati `socket.io`, `socket.io-client`, `zod`, `drizzle-orm`, `drizzle-kit`, `pg` e `@types/pg`; il package `realtime-server/` dichiara le proprie dipendenze runtime.
- Verifica: `npm run typecheck` passa; `npm run lint` termina senza errori ma segnala un warning preesistente per l'import `Geist` non utilizzato in `app/layout.tsx`. `npm install` ha riportato vulnerabilità nel dependency tree, da valutare senza aggiornamenti automatici non revisionati.
