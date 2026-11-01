import { config } from "dotenv"

import { listenRealtimeServer } from "./server.js"

config({ path: ".env.local" })
listenRealtimeServer()
