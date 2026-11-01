import { config } from "dotenv"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

import { questions } from "./schema.js"

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
  } finally {
    await pool.end()
  }
}

seedQuestions().catch((error: unknown) => {
  console.error("Question seed failed.", error)
  process.exitCode = 1
})
