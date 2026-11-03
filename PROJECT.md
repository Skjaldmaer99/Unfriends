# Chi mi conosce davvero?

## Descrizione

Party game multiplayer per gruppi di amici: a ogni turno un protagonista risponde in privato a una domanda personale; gli altri provano a indovinare la sua risposta. La partita si svolge in stanze private accessibili tramite codice e non richiede account.

## Stack tecnologico

| Area        | Scelta                                                | Stato nel repository                                                         |
| ----------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Frontend    | Next.js App Router, React, TypeScript                 | Presente (Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3)                    |
| UI          | Tailwind CSS 4, shadcn/ui, React Aria, Lucide, Sonner | Palette e primitive responsive implementate                                  |
| API HTTP    | Next.js Route Handlers                                | API create/join/lobby/leave e ticket socket implementate                     |
| Realtime    | Node.js, TypeScript, Socket.IO                        | Server indipendente con autenticazione, lobby e gameplay implementato        |
| Validazione | Zod                                                   | Installato nell'app e nel workspace realtime                                 |
| Persistenza | PostgreSQL, Drizzle ORM e Drizzle Kit                 | Schema, migrazione e seed implementati; applicazione richiede `DATABASE_URL` |
| Test        | Node.js test runner, TypeScript e Socket.IO clients   | Unit, HTTP e realtime integration suite (`npm test`)                         |

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
  page.tsx           Home con creazione e accesso stanza
  api/rooms/         Creazione e gestione HTTP delle stanze
  room/[code]/       Destinazione stanza e snapshot iniziale
components/
  ui/                Button, input, dialog, avatar, badge, card, toast, timer,
                     progress, player card, score badge e loading state
  room/              Lobby realtime, header, codice, lista giocatori, settings,
                     host controls, stato pronto e footer
  lobby/             Componenti della lobby
  game/              Componenti della partita
  shared/            Componenti condivisi
hooks/               Hook React, incluso il collegamento al realtime
lib/                 Database, sessioni, codici e servizi room
realtime-server/
  src/
    auth/            Ticket Socket.IO firmati
    game/            Modello del gameplay e test unitari
    protocol.ts      Schemi e payload Socket.IO tipizzati
    server.ts        Server Socket.IO, lobby e gameplay
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
| 2. Regole di gameplay         | Completata              | Motore puro: fasi, privacy delle viste, punteggio, timer, rotazione e test.        |
| 3. Database e dati            | Completata              | Sei tabelle, vincoli relazionali, migrazione iniziale e 48 domande seed.           |
| 4. Gestione stanze            | Completata              | API persistenti, cookie sessione, host handoff e lobby; avvio via Socket.IO.       |
| 5. Server Socket.IO           | Completata              | Ticket firmati, eventi Zod, lobby, round, timeout, privacy e persistenza.          |
| 6. Design system              | Completata              | Token multi-tono, font dedicati, primitive accessibili e target touch da 44px.     |
| 7. Pagina home                | Completata              | Form create/join reali, avatar, validazione, errori localizzati e redirect.        |
| 8. Lobby multiplayer          | Completata              | Lobby Socket.IO, presenza/ready, invito, settings host e avvio a 3+.               |
| 9. Partita                    | Completata              | UI round server-authoritative, privacy, reveal, voto, risultato e transizione.     |
| 10. Classifica e fine partita | Completata              | Riepilogo, statistiche, riconoscimenti, classifica e replay host-only.             |
| 11. Stato e sessioni          | Completata              | Snapshot persistente, recovery Socket.IO e sessioni recuperabili.                  |
| 12. Sicurezza e validazione   | Completata              | Zod strict, body cap, autorizzazioni e rate limit HTTP/realtime.                   |
| 13. Testing                   | Completata              | Suite aggregata, copertura unit/HTTP e partita realtime integrale con reconnect.   |
| 14. Deployment                | Completata              | Manifest Vercel/Render, migrations pre-deploy, env e shutdown graceful.            |
| 15. Funzionalità future       | Non pianificata per MVP | Architettura estendibile senza implementare queste feature ora.                    |

## Avvio locale

Prerequisiti: Node.js compatibile con Next.js 16, npm e PostgreSQL per migrazioni/seed. L'app web attuale continua ad avviarsi senza database.

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`. Per i controlli disponibili:

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run test:rooms
npm test --workspace @unfriends/realtime-server
npm run typecheck --workspace @unfriends/realtime-server
npm run db:generate
npm run db:migrate
npm run db:seed
```

`npm test` esegue le suite room/HTTP e realtime. Il test di integrazione realtime crea una stanza PostgreSQL temporanea, simula 3 giocatori per tutti i round e verifica privacy, permessi, punteggi, summary e reconnect; ripulisce i dati al termine. Carica `.env.local` e viene saltato se `DATABASE_URL` non è configurato.

Per migrazioni, seed e flussi room/realtime crea `.env.local` copiando `.env.example`, poi sostituisci il placeholder con la URL PostgreSQL corretta. Esempio locale:

```env
DATABASE_URL=postgres://utente:password@localhost:5432/unfriends
```

Verifica host, porta, nome database, utente e password del tuo server; Drizzle Kit usa `5432` come porta PostgreSQL predefinita, ma può essere diversa nella tua installazione. `.env.local` è ignorato da Git. `db:generate` non richiede una connessione; `db:migrate`, `db:seed`, le API room e il server realtime sì. Non inserire credenziali reali nel repository.

Avvia il realtime server in un secondo terminale, con un segreto locale casuale condiviso con l'app Next:

```bash
export SOCKET_TICKET_SECRET="$(openssl rand -hex 32)"
export SOCKET_ALLOWED_ORIGINS="http://localhost:3000"
export SOCKET_PORT=4000
npm run dev --workspace @unfriends/realtime-server
```

Configura lo stesso `SOCKET_TICKET_SECRET` anche per Next.js. In produzione, `SOCKET_ALLOWED_ORIGINS` deve elencare origini HTTPS precise separate da virgole; i wildcard sono rifiutati. L'endpoint `GET /api/rooms/[code]/socket-ticket` emette un ticket valido 60 secondi dopo aver verificato il cookie giocatore. Creazione e join stanza usano le API HTTP; avvio, presenza e gameplay usano Socket.IO.

## Deployment

La root del repository è il progetto Next.js per Vercel; `vercel.json` dichiara framework/build e header HTTPS di base. Collega il repository a Vercel mantenendo la root directory predefinita e configura queste variabili per Production (e per Preview se si usano deployment preview):

- `DATABASE_URL`: URL PostgreSQL del provider scelto.
- `SOCKET_TICKET_SECRET`: segreto casuale di almeno 32 byte; deve corrispondere al valore Render.
- `NEXT_PUBLIC_REALTIME_URL`: URL HTTPS pubblico del servizio Render, disponibile durante la build perché viene incorporato nel bundle client.

Il file `render.yaml` definisce il realtime Node come servizio web con `/healthz`, migrazione Drizzle in pre-deploy e shutdown delay di 30 secondi. Importa il Blueprint dal repository e fornisci `DATABASE_URL` e `SOCKET_ALLOWED_ORIGINS`; `SOCKET_TICKET_SECRET` viene generato da Render. Copia quel valore in Vercel senza inserirlo nel repository. `SOCKET_ALLOWED_ORIGINS` deve contenere solo l'origine HTTPS di produzione Vercel e gli eventuali domini custom; aggiungi una preview origin solo se serve davvero. Render fornisce `PORT`, già letto dal server.

Il Blueprint usa il piano Render `0.5c-512mb` a pagamento: Render richiede un piano paid per `preDeployCommand`, e un servizio always-on evita lo spin-down durante le partite. Verifica costi e piano nel dashboard prima di creare il servizio. Mantieni una sola istanza realtime: stato attivo, code d'azione e rate limit sono per-processo; non abilitare autoscaling multi-istanza senza introdurre coordinamento condiviso.

Esegui migrazioni con `npm run db:migrate` prima di spostare un database esistente; nei deploy Render successivi vengono applicate automaticamente dal pre-deploy. Il seed iniziale è un'operazione manuale una tantum (`npm run db:seed`) usando una connessione amministrata. Non avviare `db:seed` a ogni deploy. I valori reali delle variabili restano nei dashboard dei provider e non in Git.

## Decisioni e verifiche iniziali

- La versione installata è Next.js 16.4.3 con App Router; le convenzioni sono state verificate nella documentazione installata in `node_modules/next/dist/docs/`.
- Route Handlers sono previsti nell'App Router; il server Socket.IO sarà separato e non verrà avviato tramite un custom server Next.js.
- Il repository contiene già Tailwind CSS 4, shadcn/ui, Lucide React, `next-themes` e React Aria Components.
- Configurazione Task 1: installati `socket.io`, `socket.io-client`, `zod`, `drizzle-orm`, `drizzle-kit`, `pg` e `@types/pg`; il package `realtime-server/` dichiara le proprie dipendenze runtime.
- Task 2: il dominio in `realtime-server/src/game/` definisce le fasi del round, validazione di risposte, timer, risposte private/anonime nelle viste, selezione del protagonista, punteggio e rotazione deterministica. Cinque test coprono privacy, punteggio, due giocatori, rotazione, invii non validi e selezione tra risposte coincidenti.
- Task 3: `db/schema.ts` definisce rooms, players, questions, rounds, answers e votes con vincoli per session hash, nickname/host, invii unici e voto del protagonista alla risposta dello stesso round. La migrazione `db/migrations/0000_romantic_dust.sql` è generata; `db/seed.ts` aggiunge 48 domande italiane in modo idempotente.
- Verifica Task 3: migrazione applicata al database PostgreSQL locale e seed completato (6 tabelle, 48 domande, 1 migrazione registrata). La causa iniziale era l'ordine del DDL: le foreign key composte dei voti venivano create prima degli indici univoci composti necessari; gli indici sono stati spostati prima dei vincoli nella migrazione.
- Task 4: Route Handlers `POST /api/rooms`, `POST /api/rooms/[code]/join`, `GET /api/rooms/[code]` e `POST /api/rooms/[code]/leave`; i servizi serializzano join/leave con lock di stanza, trasferiscono l'host e conservano i giocatori usciti durante la partita come disconnessi. I token sessione sono cookie `HttpOnly` e nel DB è salvato solo SHA-256. Lo start è ora solo Socket.IO, per evitare di impostare `in_progress` senza creare il round.
- Limite verifica Task 4: test unitari, typecheck e build Next passano. Il DB è ora disponibile; i flussi HTTP room non sono ancora coperti da test end-to-end dedicati.
- Task 5: server avviabile con `npm run dev --workspace @unfriends/realtime-server`, health check `/healthz`, CORS con allowlist esatta e trasporto WebSocket. Il ticket JWT è firmato, legato a player/stanza e dura 60 secondi; il middleware verifica membership nel DB. Il server valida payload con Zod, autorizza ogni evento tramite l'identità del ticket, gestisce lobby/ready/start/leave, round, risposte, voti, punteggi e timeout; scrive round/risposte/voti/punteggi in PostgreSQL e invia viste per giocatore per preservare la privacy.
- Verifica Task 5: typecheck, build Next, lint e 14 test realtime passano. I test coprono ticket, payload, health, handshake invalido e scadenze; i flussi autenticati e di partita sono verificati nelle Task 8, 9 e 11. Lo stato runtime resta in memoria per istanza, con snapshot persistente e ripristino al reconnect; il coordinamento tra più istanze richiederebbe un lock e un adapter distribuiti.
- Task 6: palette OKLCH corallo/teal/giallo con modalità chiara/scura e texture leggera, font Raleway/Inter con mapping Tailwind corretto, lingua e metadata italiani. Primitive condivise in `components/ui/`: button, input, badge, card, avatar, dialog React Aria, toast Sonner, progress, timer, player card, score badge e loading state; i pulsanti principali hanno target touch da 44px e le animazioni rispettano `prefers-reduced-motion`.
- Verifica Task 6: `npm run typecheck`, `npm run build`, `npm run lint`, 14 test realtime, 7 test room, Prettier e `git diff --check` passano.
- Task 7: home italiana responsive con apertura stanza e ingresso via codice, nickname e avatar; usa gli endpoint reali, mantiene gli errori inline e porta alla route `/room/[code]`. La route mostra lo snapshot API autenticato e permette di copiare il codice o lasciare la stanza; gli aggiornamenti live e i controlli host restano alla Task 8.
- Verifica Task 7: creazione provata nel browser fino a stanza e snapshot, uscita verificata; codice stanza inesistente mostra il messaggio previsto. A 390px non c'è overflow orizzontale. Typecheck, lint, build, 14 test realtime, 7 test room, Prettier e `git diff --check` passano.
- Task 8: lobby modulare in `components/room/` con connessione Socket.IO autenticata da ticket, reconnect, snapshot live, presenza, stato ready, condivisione codice/link, impostazioni host salvate tramite evento `room:settings`, uscita e start protetto lato server (almeno 3 connessi). La lobby riceve `game:started`; la schermata di gioco è implementata nella Task 9.
- Verifica Task 8: browser end-to-end con host e 2 guest autenticati; verificati join/broadcast, ready, salvataggio e broadcast settings, start abilitato a 3 e disabilitato dopo le disconnessioni. Il server ha aggiornato lo stato disconnected in tempo reale. Il test non ha avviato la partita e la stanza temporanea è stata rimossa. Typecheck, lint, build, 15 test realtime, 7 test room, Prettier e `git diff --check` passano.
- Task 9: componenti in `components/game/` per header/classifica, domanda/timer, form risposta, attesa, reveal anonimo e risultato; la route `/game/[code]` riceve soltanto le viste Socket.IO autenticate e delega risposta, scelta, punteggi e avanzamento al server. Le risposte originali e gli autori restano nascosti fino alla vista di risultato. La pagina mostra il risultato finale quando il server termina i round.
- Verifica Task 9: round end-to-end isolato a 3 client autenticati; reveal anonimo, originale nascosta durante reveal, autori/originale visibili al risultato, punteggi 1/3/0 e passaggio al round 2 verificati. Le transazioni score sono serializzate per evitare query concorrenti sul client PostgreSQL. Stanza E2E e precedente stanza lobby rimosse. Typecheck, lint, build, 15 test realtime, 7 test room e Prettier passano.
- Task 10: schermata finale con classifica e pari merito, conteggi round/risposte, percentuale di originali indovinate e riconoscimenti “Miglior osservatore”/“Il più difficile da indovinare” derivati dallo storico. L'evento server `game:summary` carica round, risposte e voti della partita corrente; il replay è host-only, azzera i punteggi, conserva lo storico e usa un offset DB per mantenere univoci i round nella stanza.
- Verifica Task 10: test unitari summary/tie e payload replay; E2E con 3 giocatori e 3 round, 9 risposte, 3 match esatti, summary/recognitions, replay in `waiting` con score zero e nuovo match iniziato al round UI 1 senza collisione DB (round DB successivo 4). Typecheck, lint, build, 18 test realtime, 7 test room, Prettier e `git diff --check` passano; dati test puliti.
- Task 11: `game_sessions` conserva per ogni match lo snapshot `GameState` validato con Zod, host e offset round; `rounds` collega la sessione e conserva il deadline assoluto. Le transizioni aggiornano snapshot e dati normalizzati nella stessa transazione. Al primo socket dopo un restart il server ricarica lo snapshot, rimappa gli ID risposta, ripristina i timer e invia una vista privata; gli handler sono registrati prima di `room:joined` e le azioni sono serializzate per stanza. Il hook riallinea stato e fase dopo reconnect/refresh. I cookie sessione restano HttpOnly, associati a token casuale e hash DB, con scadenza a 30 giorni.
- Verifica Task 11: migrazione locale applicata; schema snapshot coperto da test valido/invalido. E2E con 3 sessioni autenticate: server riavviato in `players_answer`, viste recuperate con risposta originale visibile solo al protagonista, risposte guest inviate in parallelo, reveal anonimo e voto/punteggi completati usando gli ID ripristinati; stanza e processi di test rimossi. Build, lint, typecheck app/server, 20 test realtime, 7 test room, Prettier e `git diff --check` passano. Limite residuo: recovery e timer sono per singola istanza, senza coordinamento multi-istanza distribuito.
- Task 12: payload create/join e settings validati con Zod strict; nickname rifiuta caratteri di controllo, risposte rifiutano NUL e restano renderizzate come testo React escaped. I body JSON di create/join sono letti in streaming e limitati a 8 KiB (413). Limiti process-local: creazione stanza 6/10 min per indirizzo, join 20/min per indirizzo, ticket realtime 30/min per sessione, handshake Socket.IO 60/min per IP e azioni Socket.IO 30/10 s per giocatore; gli eventi eccedenti ricevono 429 o `RATE_LIMITED` con indicazione di retry. Permessi, identità da ticket e transizioni server-authoritative restano invariati.
- Verifica Task 12: test deterministici del fixed-window limiter, chiavi proxy, 413 per body oversize, 429/`Retry-After`, nickname e payload annidati sconosciuti. Passano lint, build, typecheck app/server, 13 test room/HTTP, 20 realtime, Prettier e `git diff --check`. Limite residuo: i contatori sono in memoria per processo; deployment serverless o multi-istanza richiederà uno store condiviso o rate limiting all'edge. La chiave IP HTTP si basa sugli header forwarded configurati dal proxy.
- Task 13: aggiunto `npm test` come comando aggregato. Le suite coprono funzioni pure (motore, scoring, rotazione, summary, rate limiter, sessioni e validazione HTTP), route helper (body cap/errori) e server Socket.IO autenticato. Il test d'integrazione usa `createRoom`/`joinRoom` e PostgreSQL, avvia una partita completa a 3 giocatori, prova host authorization, privacy originale/autori durante reveal e visibilità al risultato, reconnect con risposta già inviata, punteggi, game summary e stato persistito `finished`; pulisce room e pool.
- Verifica Task 13: `npm test` passa con 13 test room/HTTP e 21 test realtime, senza skip nell'ambiente locale con PostgreSQL. Passano inoltre lint senza warning, typecheck app/server, build Next, Prettier e `git diff --check`. In ambienti senza `DATABASE_URL`, il solo test d'integrazione PostgreSQL viene saltato; le altre suite restano autonome.
- Task 14: `vercel.json` seleziona il preset Next.js, `npm ci` e build e aggiunge HSTS/nosniff/frame/referrer/permissions headers; `render.yaml` configura il realtime Node, health check, migrazione pre-deploy, env variabili e shutdown. `listenRealtimeServer` gestisce `SIGTERM`/`SIGINT`, cancella timer, chiude Socket.IO, attende le azioni accodate e chiude il pool PostgreSQL. `.env.example` elenca tutte le variabili locali.
- Verifica Task 14: schema YAML Render analizzato, `vercel.json` parsato come JSON, typecheck app/server, lint, test, build e Prettier passano. Deploy effettivo non eseguito: richiede account/provider, URL database, dominio Vercel e inserimento manuale dei segreti. Il Blueprint Render usa un piano paid per pre-deploy/always-on e una sola istanza per i limiti di stato documentati.
- Nota dipendenze: `npm install` ha riportato vulnerabilità nel dependency tree, da valutare senza aggiornamenti automatici non revisionati.
