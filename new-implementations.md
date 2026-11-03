# PROGETTO: UNFRIENDS

## Integrazione nuove modalità di gioco, correzione bug multiplayer e miglioramento dell'esperienza di gioco

Devi lavorare sul progetto esistente **"UNFRIENDS"**, ampliandolo con nuove modalità di gioco e correggendo alcuni problemi riscontrati durante i test online.

L'obiettivo è trasformare il progetto in una piccola piattaforma di party game multiplayer, mantenendo un'unica applicazione, un'unica gestione delle stanze e un sistema condiviso di giocatori, punteggi e sessioni.

Le nuove modalità ispirate a "Fuori Contesto" devono essere integrate all'interno di "Unfriends", non sviluppate come applicazioni separate.

---

# REGOLE GENERALI DI SVILUPPO

Prima di iniziare:

- Analizza attentamente il repository e comprendi l'architettura attuale.
- Individua le tecnologie effettivamente utilizzate e continua a utilizzare quelle già presenti.
- Non sostituire librerie o tecnologie funzionanti senza una motivazione concreta.
- Analizza il funzionamento attuale delle stanze, dei giocatori, delle partite, dei round e dei punteggi.
- Individua i componenti e le funzioni già esistenti che possono essere riutilizzati.
- Non duplicare logiche già presenti.
- Mantieni la retrocompatibilità con le partite e le funzionalità attuali.

### Organizzazione del codice

È importante mantenere il progetto modulare:

- Evita componenti React troppo lunghi e difficili da mantenere.
- Separa le schermate dai singoli componenti.
- Crea componenti riutilizzabili per gli elementi condivisi tra le modalità.
- Separa la logica di gioco dalla logica di presentazione.
- Mantieni separati i componenti specifici delle singole modalità.
- Evita di inserire tutta la logica multiplayer, di punteggio e di gestione dei round all'interno dei componenti React.
- Riutilizza gli hook, i servizi e le utility già presenti.
- Utilizza TypeScript in modo rigoroso, evitando `any`.
- Utilizza Zod per la validazione dei dati, se già presente nel progetto.
- Utilizza i componenti Shadcn UI già disponibili, evitando di ricreare componenti equivalenti.
- Mantieni una gestione coerente dello stato e delle richieste HTTP e realtime.

### Modalità di lavoro

Procedi una task alla volta.

Per ogni task:

1. Analizza cosa deve essere modificato.
2. Individua i file interessati.
3. Implementa la funzionalità separando correttamente i componenti.
4. Verifica che non siano stati introdotti errori TypeScript, lint o regressioni.
5. Verifica il funzionamento della funzionalità prima di passare alla task successiva.

Non implementare tutte le task contemporaneamente.

---

# TASK 0 – ANALISI DEL PROGETTO ESISTENTE

Prima di modificare il codice, analizza il progetto.

### Sottotask 0.1 – Analisi architettura [x]

Individua:

- Struttura del frontend.
- Backend e API.
- Server realtime e gestione Socket.IO.
- Database e ORM.
- Gestione delle stanze.
- Gestione dei giocatori.
- Gestione dell'host.
- Gestione delle partite e dei round.
- Sistema di punteggio.
- Gestione delle risposte e delle votazioni.
- Gestione della riconnessione dei giocatori.

### Sottotask 0.2 – Analisi del gameplay attuale [x]

Ricostruisci il flusso completo della modalità attuale:

1. Creazione della stanza.
2. Ingresso dei giocatori.
3. Attesa nella lobby.
4. Avvio della partita.
5. Svolgimento dei round.
6. Invio delle risposte.
7. Scelta della risposta vincente.
8. Assegnazione dei punti.
9. Conclusione della partita.
10. Avvio di una nuova partita.

Individua quali parti possono essere riutilizzate dalle nuove modalità.

### Sottotask 0.3 – Piano di implementazione [x]

Prima di procedere, crea un breve piano che indichi:

- Quali componenti esistenti saranno modificati.
- Quali componenti saranno creati.
- Quali modifiche saranno necessarie al database.
- Quali eventi Socket.IO dovranno essere aggiunti o modificati.
- Quali logiche di gioco potranno essere condivise.

Non modificare ancora il codice durante questa fase.

### Risultato dell'analisi Task 0

- Frontend: Next.js App Router; `components/room/use-room-lobby.ts` possiede il client Socket.IO e lo stato UI. `RoomLanding` apre la lobby, `GameScreen` gestisce la partita e la schermata finale chiama il replay.
- API: Route Handler Next.js per creazione/join/snapshot/leave/ticket; sessione `HttpOnly` identificata da hash nel database. L'uscita dalla lobby usa HTTP e non dipende dal socket.
- Realtime/dati: Socket.IO valida ticket e membership; PostgreSQL/Drizzle conserva rooms/players e `game_sessions` con snapshot Zod-validato, round, answers e votes. Il server mantiene anche una cache runtime `activeGames` e la ricostruisce al reconnect.
- Gameplay attuale: create room e host → join via codice → lobby/ready/settings → host start e creazione sessione/round → risposta originale privata → risposte degli altri → reveal anonimo → voto host/protagonista → scoring persistito → round successivi → room/game `finished` e summary → host replay che azzera i punteggi, conserva lo storico e riporta la room a `waiting`.
- Causa individuata dell'errore: `handleConnection` tenta il restore anche quando lo snapshot DB dice `waiting`. Dopo replay rimane legittimamente una sessione storica `finished`; `restoreGameForRoom` confronta quella sessione con la room `waiting` e lancia, causando `CONNECTION_SETUP_FAILED` con testo “The room state could not be loaded.” Il piano Render gratuito può provocare il reconnect risvegliando o riavviando il processo, ma non è la causa logica: rende visibile il ramo di restore della lobby.
- Piano: modificare `realtime-server/src/server.ts` per trattare lo stato DB `waiting` come autorevole e non ripristinare sessioni storiche; installare gli handler di disconnect prima delle operazioni che possono fallire. Estendere `realtime-server/src/server.integration.test.ts` con il ciclo partita completata → replay → reconnect in lobby → nuovo start, verificando anche che l'host e gli altri pulsanti restino utilizzabili.
- Dati/eventi/UI: non servono nuove tabelle né nuovi eventi Socket.IO; si riusano sessioni/round esistenti e gli eventi `room:joined`, `game:replayed`, `game:state`, `game:started`. Si toccherà `components/room/use-room-lobby.ts` soltanto se il test conferma che un ack/socket error lascia azioni UI bloccate; l'uscita HTTP e la navigazione diretta alla home devono restare indipendenti dal realtime.
- Verifica: test d'integrazione con PostgreSQL che riproduce il reconnect dopo replay, suite `npm test`, lint/typecheck/build e prova del teardown del server quando applicabile.

---

# TASK 1 – CORREZIONE DELLA GESTIONE DELLE STANZE E DELLE CONNESSIONI REALTIME

## Problema riscontrato

Dopo aver effettuato il deploy online su Vercel e aver testato il gioco, alla fine di una partita, quando l'host clicca sul pulsante per iniziare una nuova partita, compare il seguente errore:

`The room state could not be loaded.`

Dopo che si verifica questo errore:

- Il pulsante per uscire dalla stanza non funziona.
- Anche altri pulsanti smettono di funzionare correttamente.
- L'utente rimane bloccato nella schermata.
- Per tornare alla schermata principale è necessario modificare manualmente l'URL.

Il problema è stato riscontrato nel deploy online:
https://unfriends.vercel.app/

Il backend realtime è ospitato su Render.

Verifica se il problema può essere collegato alle limitazioni del piano gratuito di Render, ma non dare per scontato che sia questa la causa.

La soluzione deve correggere il problema alla radice.

### Sottotask 1.1 – Analisi del ciclo di vita delle stanze [x]

Verifica:

- Cosa succede alla stanza quando una partita termina.
- Se lo stato della stanza viene aggiornato correttamente.
- Se la stanza viene eliminata accidentalmente.
- Se il riferimento alla stanza rimane valido nel frontend.
- Se il server realtime conserva lo stato delle stanze esclusivamente in memoria.
- Se la creazione di una nuova partita riutilizza correttamente la stanza esistente.
- Se vengono mantenuti riferimenti a una vecchia partita o a un vecchio round.
- Se esistono problemi di sincronizzazione tra frontend, backend e database.

Individua il punto esatto in cui viene generato l'errore `The room state could not be loaded`.

### Sottotask 1.2 – Verifica delle limitazioni di Render [x]

Analizza il comportamento del servizio Render utilizzato dal progetto.

Considera che i servizi gratuiti possono entrare in sospensione dopo un periodo di inattività e che una nuova richiesta può richiedere del tempo prima che il server torni disponibile.

Verifica:

- Cosa succede quando il server viene sospeso.
- Come viene gestita la riconnessione Socket.IO.
- Se il client riesce a ristabilire la connessione.
- Se dopo la riconnessione viene recuperato lo stato corretto della stanza.
- Se il server perde dati importanti a causa di riavvii o nuove istanze.
- Se il frontend effettua richieste mentre il server realtime non è ancora disponibile.

Non introdurre soluzioni artificiali come ricaricare continuamente la pagina o cambiare URL.

### Sottotask 1.3 – Gestione robusta dello stato delle stanze [x]

Verifica che lo stato della partita non dipenda esclusivamente dalla memoria del processo Node.js.

Se attualmente le informazioni necessarie per recuperare una partita sono conservate soltanto in memoria, valuta e implementa una gestione persistente tramite il database già presente.

Il sistema deve permettere di:

- Recuperare una stanza esistente.
- Recuperare lo stato della partita corrente.
- Recuperare i giocatori presenti.
- Recuperare il round corrente.
- Recuperare le risposte e le selezioni già effettuate.
- Riprendere correttamente una partita dopo una riconnessione.
- Distinguere una partita conclusa da una partita ancora in corso.

Evita di introdurre una seconda fonte di verità per lo stato della partita.

Il backend deve rimanere autorevole: il frontend non deve poter modificare autonomamente lo stato della stanza.

### Sottotask 1.4 – Riconnessione Socket.IO [x]

Implementa una gestione affidabile della riconnessione.

Quando un giocatore perde temporaneamente la connessione:

- Mostra un indicatore di riconnessione.
- Tenta automaticamente di ristabilire la connessione.
- Una volta riconnesso, recupera lo stato aggiornato della stanza.
- Evita di duplicare il giocatore nella stanza.
- Evita di duplicare risposte, voti o assegnazioni di punti.
- Ripristina correttamente l'interfaccia in base alla fase attuale della partita.

Gestisci anche il caso in cui sia l'host a disconnettersi e successivamente riconnettersi.

### Sottotask 1.5 – Gestione degli errori frontend [x]

Attualmente, dopo l'errore, anche i pulsanti per uscire e altre azioni non funzionano.

Verifica se questo comportamento dipende da:

- Stato di loading che rimane attivo.
- Promise non gestite.
- Errori Socket.IO non intercettati.
- Stato React non aggiornato.
- Event listener duplicati o non rimossi.
- Stato globale della partita che rimane bloccato.

Correggi il problema.

Anche quando il server realtime non è raggiungibile, l'utente deve poter:

- Tornare alla schermata principale.
- Uscire dalla stanza.
- Visualizzare un messaggio di errore comprensibile.
- Ritentare la connessione.

Le azioni di navigazione e uscita non devono dipendere obbligatoriamente dalla disponibilità del socket.

### Sottotask 1.6 – Nuova partita nella stessa stanza [x]

Correggi il funzionamento del pulsante per iniziare una nuova partita.

Quando l'host termina una partita e decide di iniziarne un'altra:

- La stanza deve rimanere valida.
- I giocatori devono rimanere nella lobby, salvo diversa scelta dell'host.
- I punteggi della partita precedente devono essere gestiti correttamente.
- Deve essere creata una nuova istanza di partita.
- Il vecchio stato dei round non deve interferire con quello nuovo.
- Le vecchie risposte e i vecchi voti non devono essere riutilizzati.
- Tutti i giocatori devono ricevere lo stesso aggiornamento realtime.
- L'host deve poter configurare la nuova partita.

Non creare una nuova stanza automaticamente se il comportamento attuale prevede di mantenere quella esistente.

### Sottotask 1.7 – Verifiche locali [x]

Testa almeno questi scenari:

1. [x] Partita completata, replay, host riconnesso e nuova partita avviata nella stessa stanza.
2. [x] Giocatore esce dopo la conclusione; resta recuperabile e rientra dopo il replay.
3. [x] Guest si disconnette durante la raccolta risposte, poi rientra con la risposta già salvata.
4. [x] Recovery dopo restart del processo verificato nel test E2E della Task 11; Render documenta spin-down dopo 15 minuti e wake-up di circa un minuto.
5. [x] Host si disconnette e si riconnette alla lobby senza perdere il ruolo.
6. [x] Riavvio del server realtime simulato e verificato nel test E2E della Task 11.
7. [x] Servizio DB di leave provato dopo la chiusura del Socket.IO server; il browser usa l'API Next HTTP per lasciare la stanza e naviga alla home indipendentemente dal socket. L'endpoint HTTP non è stato testato end-to-end con un browser.
8. [x] Host e guest si riconnettono contemporaneamente; roster senza duplicati e nuovo start riuscito.

### Esito Task 1

La causa radice era il restore della partita eseguito anche in stato room `waiting`: dopo il replay l'ultima sessione storica resta `finished`, e il controllo di coerenza falliva prima di completare il socket setup. Il server ora considera autorevole lo snapshot room: non carica sessioni quando `waiting`, ma ripristina la sessione corrente quando `in_progress`/`finished`. Registra eventi e listener disconnect prima del restore e trasforma un errore di snapshot in `GAME_STATE_UNAVAILABLE`, mantenendo utilizzabili gli eventi lobby e il percorso di uscita.

Nel client, se la stanza è caricata via HTTP ma il socket non ha ancora fornito `gameView`, non rimane più in loading infinito: mostra retry, ritorno alla lobby e home. Alla disconnessione azzera gli indicatori delle azioni pending, mantenendo il tentativo automatico Socket.IO già configurato; leave resta via API HTTP e non richiede un socket connesso.

Test d'integrazione con PostgreSQL: partita completa, replay e reset score, un giocatore esce, guest e host si riconnettono contemporaneamente, roster senza duplicati, ruolo host conservato e nuova partita avviata nella stessa stanza. La disconnessione a metà partita ripristina anche la risposta già salvata. Il test di restart reale del processo era stato eseguito e documentato nella verifica della Task 11. Suite completa, typecheck app/server, lint e build passano.

Il free tier Render sospende un web service dopo 15 minuti senza traffico e la riattivazione può richiedere circa un minuto; questa è una causa possibile delle disconnessioni, non dell'incoerenza waiting/finished. Il problema è corretto nel percorso di stato. Restano da verificare online sul deploy `unfriends.vercel.app` + Render la cold start e il ciclo completo; la sottotask di test deploy della Task 10 nel piano resta aperta fino a tale prova.

---

# TASK 2 – POSSIBILITÀ DI SELEZIONARE PIÙ RISPOSTE VINCENTI

## Obiettivo

Attualmente il protagonista può selezionare una sola risposta come vincente.

Vorrei introdurre la possibilità di selezionare più risposte quando due o più giocatori hanno dato risposte ugualmente valide, simili o altrettanto affini.

### Sottotask 2.1 – Modifica della selezione

Nella fase in cui il protagonista deve scegliere la risposta più affine:

- Deve poter selezionare una risposta.
- Deve poter selezionare più risposte.
- Deve poter deselezionare una risposta precedentemente selezionata.
- Deve essere chiaramente visibile quali risposte sono state selezionate.
- Deve essere presente un pulsante per confermare la selezione.

Non permettere di confermare senza aver selezionato almeno una risposta.

### Sottotask 2.2 – Modifica del modello dati

Verifica se attualmente il backend e il database prevedono un solo vincitore.

Se necessario, modifica la struttura per supportare più risposte vincenti.

La selezione deve essere rappresentata in modo coerente sia nel backend sia nel frontend.

Non limitarti a modificare l'interfaccia: la possibilità di selezionare più vincitori deve essere gestita anche dalle regole del server.

### Sottotask 2.3 – Sistema di punteggio

Adatta il sistema di punteggio esistente.

Se il protagonista seleziona più risposte:

- Tutti gli autori delle risposte selezionate devono essere considerati vincitori del round.
- Tutti devono ricevere i punti previsti per una risposta vincente.
- Il protagonista deve ricevere i punti previsti per la scelta, secondo le regole già presenti.

Mantieni invariato il sistema di punteggio attuale, salvo le modifiche strettamente necessarie per supportare più vincitori.

Evita che un giocatore possa ricevere punti duplicati per aver selezionato più volte la stessa risposta.

### Sottotask 2.4 – Risultato del round

Quando sono state selezionate più risposte:

- Mostra tutti i giocatori vincitori.
- Mostra le rispettive risposte.
- Evidenzia chiaramente che si tratta di un pareggio o di più risposte considerate vincenti.
- Aggiorna correttamente la classifica.

---

# TASK 3 – MIGLIORAMENTO DELLA SELEZIONE DELLE RISPOSTE

## Problema riscontrato

Durante la fase in cui un giocatore deve scegliere la risposta più affine, gli altri partecipanti visualizzano le risposte come pulsanti cliccabili.

Questo non deve accadere.

Soltanto il giocatore autorizzato a effettuare la selezione deve poter interagire con le risposte.

### Sottotask 3.1 – Distinzione tra giocatore selezionatore e osservatori

Quando un giocatore deve scegliere la risposta più affine:

- Il giocatore che deve effettuare la scelta visualizza le risposte come elementi selezionabili.
- Gli altri giocatori visualizzano le stesse risposte, ma come semplici elementi informativi.
- Gli altri giocatori non devono poter cliccare sulle risposte.
- Non devono poter modificare la selezione.
- Non devono poter inviare eventi di selezione al server.

La distinzione deve essere gestita in base al ruolo del giocatore nella fase corrente della partita.

Non basarti esclusivamente su controlli CSS o sulla disabilitazione visiva dei pulsanti.

### Sottotask 3.2 – Esperienza visiva

Per il giocatore che deve scegliere:

- Le risposte devono avere uno stato hover.
- Deve essere evidente quali risposte sono selezionate.
- Deve essere possibile selezionare più risposte.
- Deve essere presente un pulsante di conferma.

Per gli altri giocatori:

- Le risposte devono mantenere un aspetto leggibile.
- Non devono avere hover da elemento interattivo.
- Non devono mostrare un cursore che suggerisca la possibilità di cliccare.
- Non devono presentare pulsanti o controlli di selezione.

### Sottotask 3.3 – Dopo la selezione

Quando il giocatore autorizzato conferma la selezione:

Tutti i partecipanti devono visualizzare il risultato del round.

Deve apparire:

- Il nome del giocatore vincitore.
- La risposta che ha fornito.
- Se ci sono più vincitori, tutti i relativi nomi e le rispettive risposte.

Mantieni il comportamento visivo già presente per la rivelazione del vincitore, adattandolo alla possibilità di avere più risposte selezionate.

### Sottotask 3.4 – Validazione backend

Il backend deve verificare che:

- Soltanto il giocatore autorizzato possa selezionare le risposte.
- La selezione avvenga soltanto nella fase corretta.
- Le risposte selezionate appartengano effettivamente al round corrente.
- Non vengano selezionate risposte inesistenti o duplicate.
- Non sia possibile modificare il risultato dopo la conferma.

---

# TASK 4 – INTEGRAZIONE DELLE NUOVE MODALITÀ DI GIOCO

## Obiettivo

Ampliare "Unfriends" integrando nuove modalità ispirate al progetto "Fuori Contesto".

Non creare una nuova applicazione, un nuovo progetto o un sistema di stanze separato.

Tutte le modalità devono essere selezionabili all'interno della stessa applicazione e devono utilizzare:

- La stessa gestione delle stanze.
- La stessa lobby.
- Gli stessi giocatori.
- La stessa infrastruttura realtime.
- Il sistema condiviso di punteggio.
- La stessa classifica.
- La stessa gestione delle partite.

La modalità originale deve rimanere disponibile e continuare a funzionare come modalità classica.

## Sottotask 4.1 – Sistema modulare delle modalità

Prima di implementare le singole modalità, crea una struttura che permetta di gestire più modalità di gioco senza duplicare il motore principale.

Ogni modalità deve poter definire:

- Nome.
- Descrizione.
- Icona.
- Numero minimo di giocatori.
- Numero massimo di giocatori, se necessario.
- Numero di round.
- Regole specifiche.
- Fasi di gioco.
- Azioni consentite.
- Sistema di punteggio.
- Condizioni di conclusione.

Le modalità devono condividere il ciclo di vita generale della partita.

Dove possibile, crea componenti e funzioni riutilizzabili.

Non creare un unico componente React enorme con condizioni per tutte le modalità.

Separa la logica di ciascuna modalità in moduli dedicati.

---

## Sottotask 4.2 – Modalità CLASSICA: Unfriends

Mantieni la modalità originale.

Il funzionamento attuale deve rimanere invariato:

- Un giocatore è il protagonista del round.
- Il protagonista risponde alla domanda in modo segreto.
- Gli altri giocatori cercano di fornire la risposta che ritengono più affine a quella del protagonista.
- Le risposte vengono mostrate in forma anonima.
- Il protagonista seleziona la o le risposte più affini.
- Vengono rivelati i vincitori.
- Vengono assegnati i punti.

Questa modalità deve continuare a essere il riferimento per il funzionamento generale dell'applicazione.

---

## Sottotask 4.3 – Modalità SITUAZIONI ASSURDE

### Descrizione

Una modalità in cui i giocatori devono inventare risposte divertenti e creative a situazioni improbabili.

Esempio:

"Ti svegli e scopri che il tuo gatto è diventato il nuovo presidente del Consiglio. Qual è la sua prima legge?"

### Funzionamento

1. Il sistema mostra una situazione assurda.
2. Tutti i giocatori devono inviare una risposta.
3. Le risposte vengono raccolte e rese anonime.
4. Le risposte vengono mostrate a tutti.
5. I giocatori votano la risposta che ritengono più divertente.
6. Al termine della votazione vengono rivelati gli autori.
7. Vengono assegnati i punti.

### Regole

- Un giocatore non può votare la propria risposta.
- Ogni giocatore può votare una sola risposta.
- La votazione deve essere segreta fino alla conclusione.
- Il sistema deve gestire correttamente eventuali pareggi.
- L'host non deve poter manipolare i risultati.

### Punteggio

Prevedi un sistema iniziale in cui:

- La risposta più votata riceve i punti previsti per la vittoria.
- Gli autori di risposte a pari merito vengono considerati vincitori.
- I giocatori che votano una risposta vincente possono ricevere un piccolo bonus.

Mantieni il sistema di punteggio configurabile e centralizzato.

---

## Sottotask 4.4 – Modalità IL BLUFF

### Descrizione

Una modalità basata sull'inganno e sulla capacità di riconoscere la risposta vera.

Esempio:

Il sistema mostra una domanda fattuale:

"Qual è l'animale che dorme più ore al giorno?"

I giocatori devono inventare risposte false ma plausibili.

Il sistema inserisce anche la risposta corretta e mescola tutte le opzioni.

### Funzionamento

1. Il sistema mostra una domanda.
2. Ogni giocatore inserisce una risposta falsa.
3. Il sistema raccoglie le risposte.
4. Il sistema aggiunge la risposta corretta.
5. Tutte le risposte vengono mescolate.
6. I giocatori devono individuare quella vera.
7. Vengono mostrati i risultati.
8. Vengono assegnati i punti.

### Regole

- Le risposte devono essere anonime durante la votazione.
- Ogni giocatore può selezionare una sola risposta.
- Non deve essere possibile modificare il voto dopo la conferma.
- Il giocatore non deve conoscere in anticipo la risposta corretta.
- Il backend deve conservare la risposta vera e impedire che venga esposta prematuramente al frontend.

### Punteggio

Prevedi:

- Punti per chi individua la risposta corretta.
- Punti per chi riesce a convincere gli altri giocatori a scegliere il proprio bluff.

La seconda regola deve essere implementata in modo da premiare il bluff senza creare situazioni di punteggio anomale.

### Contenuti

Le domande devono essere conservate in una struttura dedicata.

Ogni domanda deve poter contenere:

- Testo.
- Risposta corretta.
- Spiegazione della risposta.
- Categoria.
- Eventuale fonte di verifica.

Non utilizzare risposte inventate dal modello senza verificarne l'attendibilità.

---

## Sottotask 4.5 – Modalità CHI TRA NOI?

### Descrizione

Una modalità in cui i giocatori devono votare quale partecipante corrisponde maggiormente a una determinata situazione.

Esempi:

- Chi sopravviverebbe più a lungo a un'apocalisse zombie?
- Chi diventerebbe famoso per un motivo assurdo?
- Chi spenderebbe tutti i propri soldi in un giorno?
- Chi sarebbe il primo a perdersi durante un viaggio?

### Funzionamento

1. Il sistema mostra una domanda.
2. Ogni giocatore vota un altro partecipante.
3. Il voto è segreto.
4. Non è possibile votare sé stessi.
5. Al termine della votazione vengono mostrati i risultati.
6. Viene rivelato chi ha ricevuto più voti.
7. Vengono assegnati i punti.

### Regole

- Ogni giocatore può votare una sola persona.
- Non è possibile votare sé stessi.
- I voti non devono essere visibili prima della conclusione.
- Devono essere gestiti correttamente i pareggi.
- Deve essere possibile configurare la modalità senza punteggio, come semplice attività divertente.

### Risultati

Mostra:

- Giocatore più votato.
- Numero di voti ricevuti.
- Distribuzione dei voti.
- Eventuali pareggi.

---

## Sottotask 4.6 – Modalità IL PERSONAGGIO SEGRETO

### Descrizione

Una modalità cooperativa basata su ruoli e obiettivi segreti.

Ogni giocatore riceve un personaggio o un ruolo con una particolare personalità, esigenza o obiettivo.

Esempio di scenario:

"Un gruppo di amici deve organizzare una vacanza con un budget limitato."

I giocatori ricevono ruoli differenti:

- Uno vuole spendere il meno possibile.
- Uno vuole assolutamente un hotel di lusso.
- Uno vuole andare in un posto isolato.
- Uno è terrorizzato dagli imprevisti.
- Uno vuole organizzare attività estreme.

Gli altri giocatori devono capire quale ruolo ha ciascun partecipante.

### Funzionamento

1. Il sistema seleziona uno scenario.
2. Ogni giocatore riceve un ruolo segreto.
3. Ogni giocatore visualizza soltanto il proprio ruolo.
4. I partecipanti discutono e interagiscono tra loro.
5. Al termine della discussione, ogni giocatore prova a indovinare i ruoli degli altri.
6. Il sistema raccoglie le risposte.
7. Vengono rivelati i ruoli.
8. Vengono assegnati i punti.

### Regole

- I ruoli devono essere visibili soltanto al giocatore interessato.
- Il backend deve impedire che un giocatore possa richiedere i ruoli segreti degli altri.
- Ogni giocatore può inviare una sola serie di ipotesi.
- Le ipotesi devono essere validate dal server.
- La fase di discussione deve avere una durata configurabile.

### Contenuti

Ogni scenario deve poter contenere:

- Titolo.
- Descrizione.
- Numero minimo di giocatori.
- Numero massimo di giocatori.
- Elenco dei ruoli.
- Descrizione dei singoli ruoli.
- Obiettivi segreti.
- Soluzioni corrette.

---

## Sottotask 4.7 – CAOS MODE

### Descrizione

Aggiungi una funzionalità opzionale chiamata "Caos Mode".

Non deve essere una modalità di gioco indipendente, ma un sistema di eventi casuali che può modificare temporaneamente le regole di una partita.

Esempi di eventi:

- Rispondi soltanto con domande.
- Hai soltanto 15 secondi per rispondere.
- Devi difendere una posizione opposta alla tua.
- Il tuo nickname viene temporaneamente nascosto.
- Devi concordare una risposta con un altro giocatore.
- Puoi votare soltanto dopo aver aspettato alcuni secondi.

### Funzionamento

- L'host può attivare o disattivare Caos Mode prima della partita.
- Il sistema seleziona casualmente un evento compatibile con la modalità corrente.
- L'evento viene mostrato a tutti i giocatori interessati.
- Gli effetti vengono applicati soltanto per la durata prevista.
- Al termine, la partita torna alle regole normali.

### Struttura degli eventi

Ogni evento deve avere:

- ID.
- Nome.
- Descrizione.
- Effetto.
- Durata.
- Modalità compatibili.
- Numero minimo di giocatori, se necessario.
- Eventuali condizioni di attivazione.

Non implementare effetti che rendano impossibile completare un round o che permettano di alterare il risultato della partita.

---

# TASK 5 – SELEZIONE DELLA MODALITÀ NELLA LOBBY

## Obiettivo

Permettere all'host di scegliere quale modalità utilizzare prima di iniziare una partita.

### Sottotask 5.1 – Interfaccia di selezione

Nella lobby aggiungi una sezione dedicata alla selezione della modalità.

Mostra le modalità disponibili come card.

Ogni card deve contenere:

- Nome.
- Icona.
- Breve descrizione.
- Numero minimo di giocatori.
- Eventuali caratteristiche particolari.

Le modalità devono essere facilmente distinguibili.

Mantieni lo stile grafico già presente nell'applicazione.

### Sottotask 5.2 – Permessi

- Soltanto l'host può modificare la modalità.
- Gli altri giocatori possono visualizzare la modalità selezionata.
- Quando l'host cambia modalità, tutti i giocatori devono ricevere l'aggiornamento realtime.
- Non permettere di cambiare modalità dopo l'inizio della partita.

### Sottotask 5.3 – Validazione giocatori

Prima dell'avvio:

- Verifica che il numero di partecipanti sia sufficiente.
- Verifica eventuali requisiti specifici della modalità.
- Mostra un messaggio comprensibile se non è possibile iniziare.

### Sottotask 5.4 – Impostazioni partita

Prevedi impostazioni configurabili dall'host, dove pertinenti:

- Numero di round.
- Durata delle fasi.
- Caos Mode.
- Punteggio attivo o disattivo.
- Eventuali altre impostazioni specifiche della modalità.

Non mostrare impostazioni che non hanno effetto sulla modalità selezionata.

---

# TASK 6 – SISTEMA CONDIVISO DI PUNTEGGIO E CLASSIFICA

## Obiettivo

Permettere a tutte le modalità di utilizzare un sistema coerente di punteggio.

### Sottotask 6.1 – Punteggio centralizzato

Verifica il sistema attuale e crea una gestione centralizzata delle assegnazioni dei punti.

Le singole modalità devono poter definire le proprie regole, ma non devono duplicare l'intera logica di aggiornamento dei punteggi.

Il backend deve essere l'unica autorità nell'assegnazione dei punti.

### Sottotask 6.2 – Classifica

La classifica deve:

- Aggiornarsi in tempo reale.
- Mostrare tutti i partecipanti.
- Gestire correttamente i pareggi.
- Aggiornare i punteggi dopo ogni round.
- Mostrare il risultato finale della partita.

### Sottotask 6.3 – Risultati finali

Alla fine della partita mostra:

- Classifica finale.
- Punteggio di ogni giocatore.
- Vincitore o vincitori.
- Eventuali statistiche interessanti della partita.

Mantieni uno stile grafico coerente con il resto dell'applicazione.

### Sottotask 6.4 – Nuova partita

Dalla schermata dei risultati l'host deve poter:

- Iniziare una nuova partita nella stessa stanza.
- Selezionare nuovamente la modalità.
- Modificare le impostazioni.
- Mantenere i giocatori presenti nella lobby.

Gli altri giocatori devono ricevere l'aggiornamento senza dover uscire e rientrare manualmente.

---

# TASK 7 – ORGANIZZAZIONE DEI CONTENUTI DI GIOCO

## Obiettivo

Creare una gestione ordinata dei contenuti utilizzati dalle diverse modalità.

### Sottotask 7.1 – Domande e situazioni

Organizza i contenuti in modo che possano essere associati alla modalità corretta.

Prevedi:

- Domande classiche.
- Situazioni assurde.
- Domande fattuali per il bluff.
- Domande "Chi tra noi?".
- Scenari per i personaggi segreti.

### Sottotask 7.2 – Categorie

Prevedi categorie per facilitare la selezione dei contenuti.

Esempi:

- Divertenti.
- Assurde.
- Quotidianità.
- Relazioni.
- Viaggi.
- Cultura generale.
- Imbarazzanti.
- Fantasia.
- Situazioni impossibili.

### Sottotask 7.3 – Database e seed

Analizza la struttura del database attuale e modifica soltanto ciò che è necessario.

Se vengono introdotte nuove tabelle:

- Utilizza l'ORM già presente.
- Crea le relative migrazioni.
- Inserisci dati iniziali di esempio.
- Mantieni relazioni e vincoli coerenti.

Evita di duplicare le domande già presenti.

### Sottotask 7.4 – Estendibilità

Organizza i contenuti in modo da poter aggiungere successivamente nuove domande, scenari, personaggi ed eventi senza dover modificare continuamente il motore di gioco.

---

# TASK 8 – ESPERIENZA UTENTE E INTERFACCIA

## Sottotask 8.1 – Coerenza grafica

Mantieni l'identità visiva attuale di "Unfriends".

Le nuove modalità devono sembrare parte della stessa applicazione.

Non creare interfacce completamente differenti per ogni modalità.

### Sottotask 8.2 – Componenti condivisi

Individua gli elementi che possono essere riutilizzati:

- Card delle modalità.
- Card delle domande.
- Card delle risposte.
- Timer.
- Indicatori di fase.
- Classifica.
- Risultati.
- Avatar e nickname.
- Messaggi di attesa.
- Indicatori di connessione.

### Sottotask 8.3 – Responsive

Verifica che tutte le nuove schermate funzionino correttamente:

- Desktop.
- Tablet.
- Smartphone.

Il gioco deve essere comodo soprattutto da smartphone, perché i partecipanti utilizzeranno probabilmente il proprio telefono durante una sessione condivisa.

### Sottotask 8.4 – Feedback

Prevedi feedback visivi per:

- Risposta inviata.
- Attesa degli altri giocatori.
- Voto inviato.
- Selezione confermata.
- Round concluso.
- Giocatore disconnesso.
- Riconnessione.
- Errore di comunicazione con il server.

---

# TASK 9 – SICUREZZA E VALIDAZIONE MULTIPLAYER

Verifica che tutte le nuove funzionalità rispettino le regole di sicurezza già presenti.

### Sottotask 9.1 – Validazione delle azioni

Ogni azione deve essere validata dal backend.

Verifica:

- Identità del giocatore.
- Appartenenza alla stanza.
- Fase corrente della partita.
- Permessi del giocatore.
- Validità dei dati inviati.
- Eventuali azioni già effettuate.

### Sottotask 9.2 – Informazioni private

Non esporre ai giocatori informazioni che devono rimanere segrete.

In particolare:

- Risposte segrete del protagonista.
- Risposta corretta della modalità bluff prima della rivelazione.
- Voti non ancora conclusi.
- Ruoli segreti.
- Selezioni non ancora confermate.

### Sottotask 9.3 – Eventi Socket.IO

Gli eventi realtime devono essere coerenti e non devono permettere:

- Invii duplicati.
- Voti multipli.
- Modifiche a round conclusi.
- Assegnazioni di punti non autorizzate.
- Modifiche alle impostazioni da parte di giocatori non host.

---

# TASK 10 – TEST E VERIFICA FINALE

Prima di considerare concluso il lavoro, verifica il funzionamento dell'intera applicazione.

### Sottotask 10.1 – Test delle modalità

Testa:

- Modalità classica.
- Situazioni assurde.
- Il bluff.
- Chi tra noi?
- Il personaggio segreto.
- Caos Mode attivo e disattivo.

### Sottotask 10.2 – Test multiplayer

Verifica il comportamento con:

- 3 giocatori.
- 4 giocatori.
- Più giocatori collegati contemporaneamente.
- Host che si disconnette.
- Giocatore che si disconnette.
- Riconnessione durante un round.
- Riconnessione dopo la conclusione di una partita.

### Sottotask 10.3 – Test delle nuove funzionalità

Verifica:

- Selezione di una risposta vincente.
- Selezione di più risposte vincenti.
- Deselezione di una risposta.
- Impossibilità per gli altri giocatori di cliccare le risposte.
- Corretta visualizzazione dei vincitori.
- Corretta assegnazione dei punti.
- Nuova partita nella stessa stanza.

### Sottotask 10.4 – Test del deploy

Verifica il comportamento nell'ambiente online, non soltanto in locale.

Controlla:

- Connessione tra frontend Vercel e server Render.
- Riconnessione Socket.IO.
- Recupero dello stato della stanza.
- Persistenza dei dati.
- Gestione degli errori.
- Avvio di una nuova partita dopo una partita conclusa.

Non considerare risolto il problema delle stanze finché non è stato verificato anche nell'ambiente di deploy.

---

# PRIORITÀ DI IMPLEMENTAZIONE

Segui questo ordine, rispettando le dipendenze tra le task:

1. TASK 0 – Analisi del progetto.
2. TASK 1 – Correzione della gestione delle stanze e delle connessioni realtime.
3. TASK 2 – Selezione di più risposte vincenti.
4. TASK 3 – Miglioramento della selezione delle risposte.
5. TASK 4 – Integrazione delle nuove modalità.
6. TASK 5 – Selezione delle modalità nella lobby.
7. TASK 6 – Sistema condiviso di punteggio e classifica.
8. TASK 7 – Organizzazione dei contenuti.
9. TASK 8 – Esperienza utente e interfaccia.
10. TASK 9 – Sicurezza e validazione.
11. TASK 10 – Test e verifica finale.

Se durante l'analisi emergono dipendenze tecniche che rendono necessario modificare leggermente l'ordine, fallo soltanto quando serve a evitare di rifare il lavoro.

## RISULTATO FINALE ATTESO

Al termine dello sviluppo voglio avere un'unica applicazione chiamata "Unfriends" che permetta agli amici di creare una stanza, invitare altri giocatori e scegliere tra diverse modalità di gioco.

La modalità classica deve continuare a funzionare come attualmente.

Le nuove modalità devono essere integrate nello stesso sistema, con lobby, giocatori, partite, punteggi e classifica condivisi.

Inoltre:

- Il problema che impedisce di iniziare una nuova partita dopo la conclusione di quella precedente deve essere risolto.
- Le disconnessioni e le riconnessioni non devono bloccare il gioco.
- Il giocatore autorizzato deve poter selezionare più risposte vincenti.
- Gli altri giocatori devono poter visualizzare le risposte senza poterle selezionare.
- Dopo la conferma devono essere mostrati correttamente tutti i vincitori e le rispettive risposte.

**Importante:** non limitarti a modificare l'interfaccia per simulare queste funzionalità. Le regole devono essere implementate correttamente anche nel backend, nel database e nella gestione realtime.
