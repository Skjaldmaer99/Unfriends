# PROGETTO: CHI MI CONOSCE DAVVERO?
## Sviluppo di una web app multiplayer – Game Development Plan

Agisci come un Senior Full Stack Developer con esperienza nello sviluppo di applicazioni multiplayer realtime, architetture web scalabili e interfacce utente moderne.

Devi sviluppare una web application chiamata **"Chi mi conosce davvero?"**, un party game online da utilizzare con amici attraverso browser desktop e smartphone.

L'applicazione deve permettere a gruppi di amici di creare stanze private, invitare altri giocatori tramite un codice, partecipare a quiz personali e cercare di indovinare le risposte degli altri componenti del gruppo.

L'obiettivo principale è creare un'esperienza divertente, immediata, intuitiva e facilmente rigiocabile.

## Avanzamento MVP

- [x] Task 0 – Analisi del progetto e organizzazione
- [x] Task 1 – Configurazione dello stack tecnologico
- [x] Task 2 – Definizione del gameplay
- [x] Task 3 – Database e modellazione dei dati
- [x] Task 4 – Sistema di gestione delle stanze
- [x] Task 5 – Server realtime con Socket.IO
- [ ] Task 6 – Design system e interfaccia
- [ ] Task 7 – Pagina home
- [ ] Task 8 – Lobby multiplayer
- [ ] Task 9 – Implementazione della partita
- [ ] Task 10 – Classifica e fine partita
- [ ] Task 11 – Gestione dello stato e dei dati
- [ ] Task 12 – Sicurezza e validazione
- [ ] Task 13 – Testing
- [ ] Task 14 – Deployment

La Task 15 è esplicitamente fuori dall'MVP e non va implementata in questa fase.

---

# TASK 0 – ANALISI DEL PROGETTO E ORGANIZZAZIONE

Prima di iniziare a scrivere codice:

### 0.1 Analisi del repository
- Analizza la struttura del progetto esistente.
- Verifica se esistono già configurazioni, dipendenze o componenti riutilizzabili.
- Non sovrascrivere file o configurazioni senza averne verificato il contenuto.
- Individua eventuali incompatibilità tra le dipendenze.
- Verifica la versione di Next.js e le convenzioni utilizzate.

### 0.2 Organizzazione dello sviluppo
- Suddividi il lavoro seguendo rigorosamente l'ordine delle task.
- Completa una task prima di passare alla successiva.
- Non implementare funzionalità appartenenti a task successive senza aver prima completato le relative dipendenze.
- Prima di modificare un file, verifica sempre come viene utilizzato nel resto del progetto.
- Evita duplicazioni di logica.
- Non creare componenti eccessivamente grandi.
- Mantieni separati componenti UI, logica applicativa, chiamate API e gestione dello stato.

### 0.3 Documentazione
Crea un file `PROJECT.md` contenente:
- Descrizione del progetto.
- Stack tecnologico.
- Architettura generale.
- Struttura delle cartelle.
- Funzionalità previste.
- Stato di avanzamento delle task.
- Istruzioni per avviare il progetto in locale.

---

# TASK 1 – CONFIGURAZIONE DELLO STACK TECNOLOGICO

Utilizza il seguente stack.

### 1.1 Frontend
- Next.js con App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Shadcn UI.
- Lucide React per le icone.

### 1.2 Backend e API
- Next.js Route Handlers per le API HTTP.
- Server Actions esclusivamente dove risultano appropriate.
- Node.js con TypeScript per il server multiplayer.
- Socket.IO per la comunicazione realtime.

### 1.3 Database
- PostgreSQL.
- Drizzle ORM.
- Drizzle Kit per migrazioni e gestione dello schema.

### 1.4 Architettura applicativa

Mantieni separati:

**Frontend**
Applicazione Next.js, responsabile dell'interfaccia, della navigazione e delle interazioni con le API.

**Backend applicativo**
Route Handlers Next.js, responsabili delle operazioni HTTP e della gestione dei dati persistenti.

**Realtime Server**
Server Node.js indipendente con Socket.IO, responsabile della gestione delle stanze, dei giocatori, dello stato delle partite e degli eventi realtime.

**Database**
PostgreSQL, utilizzato per conservare le informazioni necessarie alle partite e le domande.

Prevedi una struttura che consenta di distribuire:
- Frontend su Vercel.
- Server Socket.IO su Render.
- Database PostgreSQL su un provider compatibile.

Non utilizzare funzionalità realtime basate su polling continuo quando Socket.IO può gestire direttamente la comunicazione.

### 1.5 Struttura del progetto

Organizza il codice in modo modulare.

Una possibile struttura:

    project/
    ├── frontend/
    │   ├── src/
    │   │   ├── app/
    │   │   ├── components/
    │   │   │   ├── ui/
    │   │   │   ├── lobby/
    │   │   │   ├── game/
    │   │   │   └── shared/
    │   │   ├── hooks/
    │   │   ├── lib/
    │   │   ├── services/
    │   │   └── types/
    │   └── ...
    │
    ├── realtime-server/
    │   ├── src/
    │   │   ├── events/
    │   │   ├── rooms/
    │   │   ├── game/
    │   │   ├── services/
    │   │   ├── middleware/
    │   │   └── types/
    │   └── ...
    │
    ├── packages/
    │   └── shared/
    │       ├── types/
    │       ├── schemas/
    │       └── constants/
    │
    └── PROJECT.md

Puoi adattare la struttura se trovi una soluzione migliore, mantenendo comunque una chiara separazione delle responsabilità.

---

# TASK 2 – DEFINIZIONE DEL GAMEPLAY

Prima di implementare l'interfaccia, definisci e implementa le regole fondamentali del gioco.

## 2.1 Concetto del gioco

Il gioco si basa sulla conoscenza reciproca dei componenti di un gruppo.

A ogni round viene selezionato un giocatore, che diventa il protagonista del turno.

Il protagonista riceve una domanda personale e deve rispondere segretamente.

Gli altri giocatori devono cercare di indovinare quale risposta abbia dato.

Esempio:

Protagonista: Marco.

Domanda:
"Qual è la cosa che Marco non potrebbe mai perdonare a un amico?"

Marco scrive:
"Essere tradito alle spalle."

Gli altri giocatori devono formulare una risposta che ritengono corrisponda a quella di Marco.

Quando tutti hanno risposto, le risposte vengono mostrate contemporaneamente.

Marco può selezionare la risposta che ritiene più vicina alla propria.

## 2.2 Regole dei round

Ogni round deve seguire questo flusso:

1. Selezione del protagonista.
2. Visualizzazione della domanda.
3. Invio segreto della risposta del protagonista.
4. Raccolta delle risposte degli altri giocatori.
5. Visualizzazione contemporanea delle risposte.
6. Selezione della risposta più vicina da parte del protagonista.
7. Assegnazione dei punti.
8. Visualizzazione del riepilogo del round.
9. Passaggio al giocatore successivo.

Il protagonista non può visualizzare le risposte degli altri prima della conclusione della fase di risposta.

Gli altri giocatori non possono conoscere la risposta originale prima della fase di rivelazione.

## 2.3 Sistema di punteggio

Implementa un sistema semplice:

- 3 punti al giocatore che ha scritto la risposta scelta dal protagonista.
- 1 punto al protagonista per aver completato il proprio turno.
- 0 punti agli altri giocatori.

Il sistema deve impedire che un giocatore possa votare la propria risposta.

Se il gruppo è composto da soli due giocatori, gestisci correttamente il turno senza richiedere risposte inesistenti.

In caso di parità nella selezione della risposta vincente, il protagonista può selezionare una sola risposta tra quelle a pari merito.

## 2.4 Rotazione dei protagonisti

- Ogni giocatore deve diventare protagonista almeno una volta.
- Evita che un giocatore venga selezionato nuovamente prima che tutti abbiano completato il proprio turno.
- La partita deve terminare quando tutti i giocatori hanno completato il numero di turni previsto.

## 2.5 Configurazione della partita

Prevedi le seguenti impostazioni:

- Numero di round per giocatore.
- Durata massima delle risposte.
- Durata massima della selezione della risposta vincente.
- Categorie di domande abilitate.

Per l'MVP utilizza valori predefiniti ragionevoli e permetti all'host di modificarli prima dell'inizio.

---

# TASK 3 – DATABASE E MODELLAZIONE DEI DATI

Implementa lo schema PostgreSQL utilizzando Drizzle ORM.

Prima di creare le tabelle, verifica le relazioni necessarie ed evita di salvare informazioni ridondanti.

## 3.1 Tabella rooms

Rappresenta una stanza di gioco.

Campi indicativi:
- id.
- code.
- hostPlayerId.
- status.
- maxPlayers.
- settings.
- createdAt.
- updatedAt.

Lo status può essere:
- waiting.
- in_progress.
- finished.

## 3.2 Tabella players

Rappresenta i giocatori che partecipano alle stanze.

Campi indicativi:
- id.
- roomId.
- nickname.
- avatar.
- isHost.
- score.
- joinedAt.
- connectionStatus.

Non richiedere necessariamente la registrazione degli utenti.

Ogni giocatore deve poter partecipare tramite nickname.

Prevedi un identificativo univoco del giocatore e un sistema sicuro per recuperare la propria sessione.

## 3.3 Tabella questions

Contiene le domande disponibili.

Campi:
- id.
- text.
- category.
- difficulty.
- isActive.
- createdAt.

Prevedi categorie come:
- Amicizia.
- Personalità.
- Preferenze.
- Abitudini.
- Ricordi.
- Situazioni ipotetiche.
- Relazioni.
- Divertimento.

## 3.4 Tabella rounds

Contiene i round delle partite.

Campi:
- id.
- roomId.
- questionId.
- protagonistId.
- roundNumber.
- status.
- startedAt.
- completedAt.

## 3.5 Tabella answers

Contiene le risposte inviate.

Campi:
- id.
- roundId.
- playerId.
- content.
- isOriginalAnswer.
- createdAt.

La risposta originale del protagonista deve rimanere privata fino alla fase di rivelazione.

## 3.6 Tabella votes

Contiene la scelta del protagonista.

Campi:
- id.
- roundId.
- voterId.
- selectedAnswerId.
- createdAt.

Non permettere votazioni multiple per lo stesso round.

## 3.7 Migrazioni e seed

- Configura Drizzle Kit.
- Crea le migrazioni.
- Inserisci un primo set di domande tramite seed.
- Prevedi un numero sufficiente di domande per effettuare diverse partite di prova.
- Evita domande duplicate.
- Non inserire domande offensive o eccessivamente invasive.

Tutte le modifiche allo schema devono essere versionate tramite migrazioni.

---

# TASK 4 – SISTEMA DI GESTIONE DELLE STANZE

Implementa il sistema necessario per creare e gestire le partite.

## 4.1 Creazione stanza

Un giocatore può creare una nuova stanza.

Il sistema deve:
- Generare un codice casuale univoco.
- Creare la stanza.
- Registrare il creatore come host.
- Impostare lo stato su waiting.
- Restituire il codice di accesso.

Utilizza codici brevi, leggibili e facilmente condivisibili.

## 4.2 Accesso tramite codice

Un giocatore può entrare inserendo il codice della stanza.

Verifica:
- Che la stanza esista.
- Che sia ancora disponibile.
- Che non abbia raggiunto il limite di giocatori.
- Che non sia già iniziata o terminata.

Richiedi un nickname.

Gestisci nickname duplicati all'interno della stessa stanza.

## 4.3 Uscita dalla stanza

Permetti ai giocatori di abbandonare la stanza.

Se l'host abbandona la lobby:
- Trasferisci il ruolo di host a un altro giocatore.
- Se non ci sono altri giocatori, elimina o chiudi la stanza.

Durante una partita, gestisci l'uscita di un giocatore senza compromettere lo stato generale.

## 4.4 Gestione della lobby

Tutti i giocatori devono visualizzare:
- Nickname degli altri partecipanti.
- Avatar.
- Stato di connessione.
- Indicazione dell'host.
- Codice della stanza.
- Numero di partecipanti.

L'host deve poter avviare la partita.

L'avvio è consentito solo quando sono presenti almeno 3 giocatori.

Per l'MVP imposta un massimo di 8 giocatori.

---

# TASK 5 – SERVER REALTIME CON SOCKET.IO

Questa è una delle parti più importanti del progetto.

Il server deve essere responsabile dello stato ufficiale della partita.

Non affidare al frontend decisioni importanti come assegnazione dei punti, selezione del protagonista o avanzamento dei round.

## 5.1 Connessione

Implementa:
- Connessione Socket.IO.
- Disconnessione.
- Riconnessione.
- Autenticazione della sessione del giocatore.
- Associazione tra socket e player.
- Associazione tra giocatore e stanza.

## 5.2 Eventi della lobby

Prevedi eventi come:

Client → Server:
- room:create.
- room:join.
- room:leave.
- room:start.
- player:ready.

Server → Client:
- room:created.
- room:joined.
- room:updated.
- room:player-joined.
- room:player-left.
- room:error.
- game:started.

Definisci payload tipizzati e condivisi.

## 5.3 Eventi della partita

Client → Server:
- answer:submit.
- answer:select.
- round:next.

Server → Client:
- round:started.
- round:answer-phase.
- round:reveal.
- round:completed.
- score:updated.
- game:completed.

## 5.4 Gestione degli errori

Gestisci:
- Eventi duplicati.
- Risposte inviate fuori tempo.
- Votazioni multiple.
- Giocatori non autorizzati.
- Giocatori non appartenenti alla stanza.
- Eventi inviati nella fase sbagliata.
- Disconnessioni durante un round.

Il server deve verificare sempre che l'evento ricevuto sia valido per lo stato attuale della partita.

## 5.5 Sincronizzazione

Tutti i giocatori devono visualizzare lo stesso stato della partita.

Quando cambia una fase:
- Il server aggiorna lo stato.
- Il server comunica il nuovo stato ai partecipanti autorizzati.
- I client aggiornano la propria interfaccia.

Non inviare a tutti i giocatori dati che devono rimanere segreti.

La risposta originale deve essere visibile soltanto al protagonista fino alla fase di rivelazione.

---

# TASK 6 – DESIGN SYSTEM E INTERFACCIA

Realizza un'interfaccia moderna, colorata e divertente.

Il gioco deve avere una personalità riconoscibile.

Evita un aspetto troppo simile a un gestionale o a una dashboard aziendale.

## 6.1 Direzione grafica

Stile desiderato:
- Moderno.
- Giocoso.
- Colorato.
- Pulito.
- Leggermente cartoon.
- Animazioni fluide.
- Elementi grafici con personalità.

L'interfaccia deve risultare piacevole sia su desktop che su smartphone.

Utilizza:
- Tailwind CSS.
- Shadcn UI.
- Lucide React.
- CSS animations o Framer Motion, se necessario.

## 6.2 Componenti condivisi

Crea componenti riutilizzabili per:
- Button.
- Input.
- Dialog.
- Avatar.
- Badge.
- Card.
- Toast.
- Timer.
- Progress bar.
- Player card.
- Score badge.
- Loading state.

Utilizza Shadcn UI quando esiste un componente adatto.

Non ricreare manualmente componenti già disponibili nella libreria senza una motivazione.

## 6.3 Responsive design

L'applicazione deve essere mobile-first.

Considera che i giocatori potrebbero utilizzare smartphone diversi durante la stessa partita.

Verifica:
- Dimensioni dei pulsanti.
- Leggibilità delle domande.
- Spaziatura delle risposte.
- Layout della lobby.
- Visualizzazione della classifica.
- Utilizzo con una sola mano.

---

# TASK 7 – PAGINA HOME

Crea la schermata iniziale.

Elementi:

- Logo e nome del gioco.
- Breve descrizione.
- Pulsante "Crea una partita".
- Pulsante "Entra in una partita".
- Sezione "Come si gioca?".
- Eventuale sezione con le funzionalità principali.

La home deve comunicare immediatamente il funzionamento del gioco.

## 7.1 Creazione partita

Al click su "Crea una partita":
- Apri una schermata o dialog.
- Richiedi il nickname.
- Permetti di scegliere un avatar.
- Crea la stanza.
- Reindirizza alla lobby.

## 7.2 Accesso partita

Al click su "Entra in una partita":
- Mostra un input per il codice.
- Richiedi il nickname.
- Permetti la selezione dell'avatar.
- Effettua la validazione.
- Entra nella lobby.

Se il codice non è valido, mostra un messaggio comprensibile.

---

# TASK 8 – LOBBY MULTIPLAYER

Crea una pagina dedicata alla stanza.

## 8.1 Componenti

Separa la pagina in componenti:

- LobbyHeader.
- RoomCodeCard.
- PlayersList.
- PlayerCard.
- GameSettings.
- HostControls.
- LobbyFooter.

## 8.2 Funzionalità

- Visualizzazione dei giocatori collegati.
- Aggiornamento realtime quando entra o esce qualcuno.
- Copia del codice stanza.
- Condivisione del link di invito.
- Modifica delle impostazioni da parte dell'host.
- Indicazione dei giocatori pronti.
- Avvio della partita.

## 8.3 Stati

Gestisci:
- Lobby vuota.
- Lobby con giocatori.
- Connessione persa.
- Giocatore che si riconnette.
- Partita in fase di avvio.

---

# TASK 9 – IMPLEMENTAZIONE DELLA PARTITA

Crea la schermata principale del gameplay.

Non realizzare un unico componente enorme.

Suddividi il gioco in componenti specifici.

## 9.1 GameHeader

Mostra:
- Codice stanza.
- Round corrente.
- Numero totale di round.
- Giocatori partecipanti.
- Punteggi.

## 9.2 QuestionCard

Mostra:
- Domanda corrente.
- Nome del protagonista.
- Categoria.
- Eventuale timer.

## 9.3 AnswerForm

Permette ai giocatori di inserire la risposta.

Requisiti:
- Validazione input.
- Limite di caratteri.
- Feedback di invio.
- Stato di risposta completata.
- Blocco delle modifiche dopo l'invio.

## 9.4 WaitingPlayers

Quando un giocatore ha inviato la risposta:
- Mostra un messaggio di attesa.
- Indica quanti giocatori hanno completato la fase.
- Non mostrare il contenuto delle risposte.

## 9.5 AnswerReveal

Quando tutti hanno risposto:
- Mostra le risposte contemporaneamente.
- Nascondi inizialmente l'identità degli autori.
- Permetti al protagonista di selezionare la risposta più vicina.

Gli autori delle risposte devono essere rivelati dopo la selezione.

## 9.6 RoundResult

Mostra:
- Risposta originale.
- Risposta selezionata.
- Autore della risposta vincente.
- Punti assegnati.
- Classifica aggiornata.

Utilizza animazioni leggere per rendere il momento più divertente.

## 9.7 RoundTransition

Dopo il risultato:
- Mostra un riepilogo.
- Comunica chi sarà il prossimo protagonista.
- Passa automaticamente o tramite pulsante alla fase successiva.

---

# TASK 10 – CLASSIFICA E FINE PARTITA

## 10.1 Classifica

Durante la partita mostra una classifica aggiornata realtime.

Visualizza:
- Posizione.
- Avatar.
- Nickname.
- Punteggio.

## 10.2 Fine partita

Quando tutti i round sono terminati, mostra una schermata finale.

Elementi:
- Vincitore.
- Classifica completa.
- Punteggio di tutti i partecipanti.
- Statistiche della partita.
- Pulsante "Gioca ancora".
- Pulsante "Torna alla home".

## 10.3 Riconoscimenti divertenti

Prevedi alcuni riconoscimenti aggiuntivi, ad esempio:
- Miglior osservatore.
- Quello che conosce tutti.
- Il più imprevedibile.
- Il più difficile da capire.

Questi riconoscimenti sono accessori e non devono modificare il punteggio competitivo.

---

# TASK 11 – GESTIONE DELLO STATO E DEI DATI

Mantieni una netta separazione tra stato del server e stato dell'interfaccia.

## 11.1 Stato del gioco

Il server deve gestire una macchina a stati.

Prevedi fasi come:

- waiting.
- protagonist_answer.
- players_answer.
- reveal.
- protagonist_selection.
- round_result.
- finished.

Ogni transizione deve essere validata.

Non consentire transizioni arbitrarie.

## 11.2 Frontend

Il frontend deve:
- Ricevere gli aggiornamenti Socket.IO.
- Aggiornare l'interfaccia.
- Gestire gli stati di caricamento.
- Gestire gli errori.
- Recuperare lo stato corrente in caso di riconnessione.

Evita di duplicare sul frontend la logica di business del server.

## 11.3 Gestione delle sessioni

Non obbligare gli utenti a creare un account.

Utilizza una sessione temporanea associata al giocatore.

Implementa:
- Identificativo persistente della sessione.
- Token sicuro.
- Validazione lato server.
- Recupero della sessione dopo refresh.
- Scadenza delle sessioni.

Non utilizzare il solo nickname come identificativo o sistema di autenticazione.

---

# TASK 12 – SICUREZZA E VALIDAZIONE

Implementa controlli adeguati anche per un gioco senza account.

- Validazione dei payload tramite Zod.
- Verifica dei permessi lato server.
- Protezione delle stanze tramite sessioni.
- Limiti sulla lunghezza dei nickname.
- Limiti sulla lunghezza delle risposte.
- Rate limiting sugli eventi sensibili.
- Protezione da eventi duplicati.
- Controllo delle transizioni di stato.
- Sanitizzazione dei contenuti visualizzati.

Non fidarti mai dei dati inviati dal client per assegnare punti o modificare lo stato della partita.

Le risposte e le votazioni devono essere associate al giocatore autenticato tramite la sessione, non a un playerId arbitrario inviato dal client.

---

# TASK 13 – TESTING

Prima di considerare conclusa una funzionalità, verifica il suo funzionamento.

## 13.1 Test unitari

Testa:
- Generazione codici stanza.
- Validazione risposte.
- Calcolo punteggi.
- Rotazione protagonisti.
- Gestione parità.
- Transizioni di stato.

## 13.2 Test realtime

Verifica:
- Creazione stanza.
- Accesso multiplo.
- Aggiornamento lobby.
- Avvio partita.
- Invio risposte.
- Rivelazione.
- Selezione risposta.
- Aggiornamento punteggi.
- Riconnessione.

## 13.3 Test di gioco completo

Simula una partita con almeno 3 giocatori.

Verifica che:
- Tutti ricevano le stesse informazioni pubbliche.
- Le risposte private non siano accessibili agli altri.
- Non sia possibile inviare risposte multiple.
- Non sia possibile votare la propria risposta.
- I punteggi siano corretti.
- La partita termini correttamente.

---

# TASK 14 – DEPLOYMENT

Prepara il progetto per la pubblicazione online.

## 14.1 Frontend Vercel

Configura:
- Build Next.js.
- Variabili d'ambiente.
- URL del backend realtime.
- URL delle API.
- Gestione degli errori di connessione.

## 14.2 Server Render

Configura:
- Server Node.js.
- Avvio Socket.IO.
- CORS.
- Health check.
- Variabili d'ambiente.
- Gestione delle connessioni.
- Logging degli errori.

Non utilizzare configurazioni CORS permissive in produzione.

## 14.3 Database

Configura:
- Connessione PostgreSQL.
- Migrazioni.
- Seed iniziale.
- Variabili d'ambiente.
- Gestione degli errori di connessione.

## 14.4 Documentazione

Aggiorna PROJECT.md con:
- Istruzioni per lo sviluppo locale.
- Comandi per frontend e realtime server.
- Configurazione del database.
- Migrazioni.
- Variabili d'ambiente necessarie.
- Procedura di deployment.

Non inserire mai credenziali reali nel repository.

---

# TASK 15 – FUNZIONALITÀ FUTURE (NON IMPLEMENTARE NELL'MVP)

**Stato: fuori ambito MVP; non implementare in questa fase.**

Prepara l'architettura in modo da poter aggiungere successivamente:

1. Modalità "Chi farebbe cosa?".
2. Modalità "Ricordi condivisi".
3. Modalità "Quanto siamo compatibili?".
4. Pacchetti di domande tematici.
5. Domande personalizzate create dagli utenti.
6. Modalità coppie.
7. Modalità 18+.
8. Profili utente.
9. Statistiche personali.
10. Storico delle partite.
11. Sistema di amici.
12. Classifiche globali.
13. Eventi e sfide settimanali.

Non sviluppare queste funzionalità durante l'MVP.

Evita però di creare vincoli architetturali che ne rendano difficile l'introduzione.

---

# REGOLE GENERALI DI SVILUPPO

Queste regole devono essere rispettate durante tutte le task.

### Organizzazione del codice
- Utilizza componenti React piccoli e riutilizzabili.
- Evita componenti con troppe responsabilità.
- Separa la logica applicativa dai componenti grafici.
- Utilizza custom hook quando servono per riutilizzare logica React.
- Mantieni separati servizi API, socket client e gestione dello stato.
- Evita duplicazioni di codice.
- Utilizza nomi chiari e coerenti.

### TypeScript
- Non utilizzare `any`.
- Definisci interfacce e type per i dati.
- Utilizza tipi condivisi tra frontend e backend quando appropriato.
- Gestisci correttamente valori nullable e undefined.
- Evita cast forzati senza una motivazione.
- Utilizza discriminated unions per gli stati della partita quando appropriato.

### React
- Rispetta le regole degli hook.
- Evita useEffect inutili.
- Evita aggiornamenti di stato ridondanti.
- Gestisci correttamente la pulizia delle connessioni Socket.IO.
- Evita sottoscrizioni duplicate agli eventi.
- Non inserire tutta la logica di una pagina in un singolo componente.

### UI
- Preferisci i componenti Shadcn UI.
- Mantieni un design coerente.
- Utilizza feedback visivi per le azioni.
- Prevedi loading, error e empty states.
- Cura l'esperienza mobile.

### Database
- Utilizza Drizzle ORM.
- Gestisci le relazioni correttamente.
- Utilizza migrazioni versionate.
- Evita query ridondanti.
- Non salvare dati che possono essere ricavati facilmente da altre informazioni, salvo necessità prestazionali o di storico.

### Realtime
- Il server è sempre la fonte autorevole dello stato della partita.
- Valida ogni evento.
- Gestisci disconnessioni e riconnessioni.
- Proteggi i dati privati dei giocatori.
- Evita di inviare informazioni non necessarie.

---

# MODALITÀ DI LAVORO RICHIESTA A COPILOT

IMPORTANTE: non implementare tutte le task in un'unica operazione.

Procedi in questo modo:

1. Analizza il progetto.
2. Presenta brevemente il piano di implementazione.
3. Identifica eventuali problemi architetturali.
4. Inizia dalla TASK 0.
5. Completa una task alla volta.
6. Prima di passare alla successiva, verifica che il codice sia coerente con le task precedenti.
7. Esegui i controlli TypeScript, lint e test disponibili.
8. Risolvi gli errori introdotti dalla task corrente.
9. Aggiorna PROJECT.md.
10. Comunica quali file sono stati creati o modificati.

Per ogni task:
- Spiega brevemente cosa stai implementando.
- Elenca i componenti creati.
- Indica le eventuali dipendenze installate.
- Segnala eventuali decisioni architetturali importanti.
- Indica i controlli effettuati.
- Non modificare funzionalità già completate senza una motivazione.

Se una scelta tecnica non è chiara, proponi la soluzione più semplice e coerente con l'architettura, spiegando il motivo.

Non utilizzare mock o dati statici per simulare funzionalità che devono essere realmente implementate, salvo durante lo sviluppo di componenti UI isolati.

**Priorità assoluta: realizzare prima un MVP funzionante, stabile e divertente, poi ampliarlo.**