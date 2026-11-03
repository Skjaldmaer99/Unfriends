import { config } from "dotenv"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"

import {
    bluffQuestions,
    gamePrompts,
    questions,
    secretCharacterRoles,
    secretCharacterScenarios,
} from "./schema.js"

config({ path: ".env.local" })

const questionSeed: (typeof questions.$inferInsert)[] = [
    {
        text: "Qual è un piccolo gesto che fa sentire apprezzato?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Che cosa rende memorabile una giornata passata con gli amici?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Quale qualità cerca per prima in un buon amico?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Quale attività semplice proporrebbe per ritrovarsi tutti?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Che tipo di messaggio gradisce ricevere in una giornata impegnativa?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Qual è il modo preferito per festeggiare una bella notizia?",
        category: "friendship",
        difficulty: "easy",
    },
    {
        text: "Quale qualità descrive meglio il suo modo di affrontare le novità?",
        category: "personality",
        difficulty: "easy",
    },
    {
        text: "In quale situazione tende a dare il meglio di sé?",
        category: "personality",
        difficulty: "medium",
    },
    {
        text: "Che cosa lo aiuta a ritrovare la calma dopo una giornata piena?",
        category: "personality",
        difficulty: "easy",
    },
    {
        text: "Quale complimento gli fa più piacere ricevere?",
        category: "personality",
        difficulty: "easy",
    },
    {
        text: "Quando deve scegliere, si affida più all'istinto o ai dettagli?",
        category: "personality",
        difficulty: "medium",
    },
    {
        text: "Quale piccola sfida affronta con entusiasmo?",
        category: "personality",
        difficulty: "easy",
    },
    {
        text: "Quale snack sceglierebbe per una serata film?",
        category: "preferences",
        difficulty: "easy",
    },
    {
        text: "Quale stagione preferisce per una gita?",
        category: "preferences",
        difficulty: "easy",
    },
    {
        text: "Per una serata libera sceglierebbe un film, un gioco o una passeggiata?",
        category: "preferences",
        difficulty: "easy",
    },
    {
        text: "Quale bevanda ordinerebbe più facilmente al bar?",
        category: "preferences",
        difficulty: "easy",
    },
    {
        text: "Preferisce organizzare i viaggi in anticipo o decidere sul momento?",
        category: "preferences",
        difficulty: "medium",
    },
    {
        text: "Quale genere musicale mette di buon umore?",
        category: "preferences",
        difficulty: "easy",
    },
    {
        text: "Quale abitudine mattutina non salterebbe volentieri?",
        category: "habits",
        difficulty: "easy",
    },
    {
        text: "In quale momento della giornata ha più energia?",
        category: "habits",
        difficulty: "easy",
    },
    {
        text: "Che cosa fa di solito mentre aspetta qualcuno?",
        category: "habits",
        difficulty: "easy",
    },
    {
        text: "Quale oggetto porta spesso con sé?",
        category: "habits",
        difficulty: "easy",
    },
    {
        text: "Come preferisce ricordarsi gli impegni: lista, calendario o memoria?",
        category: "habits",
        difficulty: "easy",
    },
    {
        text: "Quale attività rimanda più facilmente a domani?",
        category: "habits",
        difficulty: "medium",
    },
    {
        text: "Quale gita o uscita ricorda con particolare piacere?",
        category: "memories",
        difficulty: "easy",
    },
    {
        text: "Quale gioco amava fare da piccolo?",
        category: "memories",
        difficulty: "easy",
    },
    {
        text: "Quale canzone gli fa tornare in mente un bel momento?",
        category: "memories",
        difficulty: "easy",
    },
    {
        text: "Quale festa o ricorrenza aspetta ogni anno con piacere?",
        category: "memories",
        difficulty: "easy",
    },
    {
        text: "Quale piatto gli ricorda casa o una persona cara?",
        category: "memories",
        difficulty: "easy",
    },
    {
        text: "Quale esperienza nuova racconta spesso con entusiasmo?",
        category: "memories",
        difficulty: "medium",
    },
    {
        text: "Se potesse imparare subito una nuova abilità, quale sceglierebbe?",
        category: "hypotheticals",
        difficulty: "easy",
    },
    {
        text: "Se avesse un pomeriggio libero inaspettato, come lo passerebbe?",
        category: "hypotheticals",
        difficulty: "easy",
    },
    {
        text: "Se potesse visitare una città per un fine settimana, quale sceglierebbe?",
        category: "hypotheticals",
        difficulty: "easy",
    },
    {
        text: "Se dovesse scegliere un tema per una festa, quale proporrebbe?",
        category: "hypotheticals",
        difficulty: "easy",
    },
    {
        text: "Se potesse cenare con un personaggio storico o immaginario, chi sceglierebbe?",
        category: "hypotheticals",
        difficulty: "medium",
    },
    {
        text: "Se avesse un giorno senza impegni, quale sarebbe la prima cosa da fare?",
        category: "hypotheticals",
        difficulty: "easy",
    },
    {
        text: "Che cosa apprezza di più in una persona con cui collabora?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        text: "Quale attività rende più piacevole passare del tempo in compagnia?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        text: "Come preferisce festeggiare un traguardo condiviso?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        text: "Quale qualità aiuta a capirsi meglio tra amici?",
        category: "relationships",
        difficulty: "medium",
    },
    {
        text: "Quale tradizione tra amici gli piacerebbe mantenere nel tempo?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        text: "Che cosa rende una conversazione davvero interessante per lui?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        text: "Quale animale sceglierebbe come compagno di avventure immaginario?",
        category: "fun",
        difficulty: "easy",
    },
    {
        text: "Quale titolo darebbe a una commedia sulla sua settimana?",
        category: "fun",
        difficulty: "easy",
    },
    {
        text: "Quale talento inutile gli piacerebbe avere?",
        category: "fun",
        difficulty: "easy",
    },
    {
        text: "Quale personaggio di fantasia inviterebbe a una serata giochi?",
        category: "fun",
        difficulty: "easy",
    },
    {
        text: "Quale regola inventerebbe per rendere più divertente una cena tra amici?",
        category: "fun",
        difficulty: "easy",
    },
    {
        text: "Quale superpotere sceglierebbe per semplificare le faccende quotidiane?",
        category: "fun",
        difficulty: "easy",
    },
]

const gamePromptSeed: (typeof gamePrompts.$inferInsert)[] = [
    {
        mode: "absurd_situations",
        text: "Il tuo frigorifero si candida a sindaco. Qual è la sua prima promessa elettorale?",
        category: "everyday_life",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Un piccione apre un ristorante stellato sul tetto. Qual è il piatto della casa?",
        category: "absurd",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "La luna manda una nota vocale alla Terra. Che cosa dice?",
        category: "fantasy",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Il tuo cane diventa il nuovo insegnante della scuola. Qual è la materia che introduce?",
        category: "impossible_situations",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Una patata viene eletta capitana di una nave pirata. Qual è il suo ordine inaugurale?",
        category: "fantasy",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Un ascensore decide di fare stand-up comedy. Qual è la sua battuta d'apertura?",
        category: "absurd",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Gli alieni arrivano sulla Terra e chiedono una sola app da provare. Quale gli consigli?",
        category: "impossible_situations",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Il tuo ombrello ottiene un profilo da influencer. Qual è il suo primo post?",
        category: "everyday_life",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Un gelato viene nominato ministro della cultura. Quale festa nazionale istituisce?",
        category: "impossible_situations",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "La sveglia di casa fonda un gruppo musicale. Come si chiama la band?",
        category: "fantasy",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Un polpo apre una scuola guida. Qual è la sua regola più importante?",
        category: "absurd",
        difficulty: "easy",
    },
    {
        mode: "absurd_situations",
        text: "Il tappeto del salotto organizza una protesta. Qual è la sua richiesta?",
        category: "everyday_life",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi si perderebbe per primo durante un viaggio anche con la mappa aperta?",
        category: "travel",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi trasformerebbe una commissione veloce in un'intera avventura?",
        category: "everyday_life",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi diventerebbe famoso per un motivo che nessuno saprebbe spiegare?",
        category: "absurd",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi riuscirebbe a fare amicizia con tutti durante una lunga attesa?",
        category: "relationships",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi racconterebbe una gaffe imbarazzante ridendo per primo?",
        category: "embarrassing",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi organizzerebbe una vacanza con un itinerario pieno di deviazioni?",
        category: "travel",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi inventerebbe la soluzione più fantasiosa a un piccolo imprevisto?",
        category: "fantasy",
        difficulty: "easy",
    },
    {
        mode: "who_among_us",
        text: "Chi accetterebbe per primo una sfida completamente improbabile?",
        category: "impossible_situations",
        difficulty: "easy",
    },
]

const bluffQuestionSeed: (typeof bluffQuestions.$inferInsert)[] = [
    {
        text: "Qual è il pianeta più grande del Sistema Solare?",
        correctAnswer: "Giove",
        explanation:
            "Giove è il pianeta più grande del Sistema Solare e ha una massa superiore a quella di tutti gli altri pianeti messi insieme.",
        sourceUrl: "https://science.nasa.gov/jupiter/",
        category: "general_knowledge",
        difficulty: "easy",
    },
    {
        text: "Quale pianeta ha il giorno più breve del Sistema Solare?",
        correctAnswer: "Giove",
        explanation:
            "Giove completa una rotazione in circa 9,9 ore, il giorno più breve tra i pianeti del Sistema Solare.",
        sourceUrl: "https://science.nasa.gov/jupiter/",
        category: "general_knowledge",
        difficulty: "medium",
    },
]

const secretScenarioSeed = [
    {
        title: "Una vacanza con budget limitato",
        description:
            "Un gruppo di amici deve scegliere e organizzare una vacanza senza superare un budget comune.",
        category: "travel" as const,
        minPlayers: 3,
        maxPlayers: 4,
        isActive: true,
    },
]

const secretRoleSeed = [
    {
        scenarioTitle: "Una vacanza con budget limitato",
        title: "Il risparmiatore",
        description: "Preferisce una meta vicina e spese ridotte.",
        secretObjective: "Convincere il gruppo a scegliere l'opzione meno costosa.",
        position: 1,
    },
    {
        scenarioTitle: "Una vacanza con budget limitato",
        title: "Il fan del lusso",
        description: "Sogna un alloggio elegante e servizi impeccabili.",
        secretObjective: "Far approvare almeno un comfort costoso senza rivelare il ruolo.",
        position: 2,
    },
    {
        scenarioTitle: "Una vacanza con budget limitato",
        title: "L'avventuriero",
        description: "Vuole attività nuove, intense e fuori programma.",
        secretObjective: "Inserire nel piano un'attività insolita e movimentata.",
        position: 3,
    },
    {
        scenarioTitle: "Una vacanza con budget limitato",
        title: "Il pianificatore prudente",
        description: "Vuole orari chiari e poche sorprese.",
        secretObjective: "Ottenere un itinerario dettagliato e alternative sicure.",
        position: 4,
    },
]

async function seedQuestions(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is required to seed questions.")
    }

    const pool = new Pool({ connectionString: databaseUrl })
    const database = drizzle(pool)

    try {
        const inserted = await database
            .insert(questions)
            .values(questionSeed)
            .onConflictDoNothing({ target: questions.text })
            .returning({ id: questions.id })

        console.info(
            `Question seed complete: ${inserted.length} added, ${questionSeed.length - inserted.length} already present.`
        )
        const seededPrompts = await database
            .insert(gamePrompts)
            .values(gamePromptSeed)
            .onConflictDoUpdate({
                target: [gamePrompts.mode, gamePrompts.text],
                set: {
                    category: sql`excluded.category`,
                    difficulty: sql`excluded.difficulty`,
                    isActive: true,
                },
            })
            .returning({ id: gamePrompts.id })
        console.info(
            `Mode prompt seed complete: ${seededPrompts.length} inserted or updated.`
        )

        const seededBluffQuestions = await database
            .insert(bluffQuestions)
            .values(bluffQuestionSeed)
            .onConflictDoUpdate({
                target: bluffQuestions.text,
                set: {
                    correctAnswer: sql`excluded.correct_answer`,
                    explanation: sql`excluded.explanation`,
                    sourceUrl: sql`excluded.source_url`,
                    category: sql`excluded.category`,
                    difficulty: sql`excluded.difficulty`,
                    isActive: true,
                },
            })
            .returning({ id: bluffQuestions.id })
        console.info(
            `Bluff question seed complete: ${seededBluffQuestions.length} inserted or updated.`
        )

        const seededScenarios = await database
            .insert(secretCharacterScenarios)
            .values(secretScenarioSeed)
            .onConflictDoUpdate({
                target: secretCharacterScenarios.title,
                set: {
                    description: sql`excluded.description`,
                    category: sql`excluded.category`,
                    minPlayers: sql`excluded.min_players`,
                    maxPlayers: sql`excluded.max_players`,
                    isActive: true,
                },
            })
            .returning({ id: secretCharacterScenarios.id, title: secretCharacterScenarios.title })
        const scenarioIdByTitle = new Map(
            seededScenarios.map((scenario) => [scenario.title, scenario.id])
        )
        for (const role of secretRoleSeed) {
            const scenarioId = scenarioIdByTitle.get(role.scenarioTitle)
            if (!scenarioId) throw new Error(`Missing scenario seed: ${role.scenarioTitle}`)
            await database
                .insert(secretCharacterRoles)
                .values({
                    scenarioId,
                    title: role.title,
                    description: role.description,
                    secretObjective: role.secretObjective,
                    position: role.position,
                })
                .onConflictDoUpdate({
                    target: [secretCharacterRoles.scenarioId, secretCharacterRoles.title],
                    set: {
                        description: sql`excluded.description`,
                        secretObjective: sql`excluded.secret_objective`,
                        position: sql`excluded.position`,
                    },
                })
        }
        console.info(`Secret-character scenario seed complete: ${secretRoleSeed.length} roles.`)
    } finally {
        await pool.end()
    }
}

seedQuestions().catch((error: unknown) => {
    console.error("Question seed failed.", error)
    process.exitCode = 1
})
