import { fileURLToPath } from "node:url"
import { config } from "dotenv"

import { listenRealtimeServer } from "./server.js"

config({ path: fileURLToPath(new URL("../../.env.local", import.meta.url)) })
listenRealtimeServer()
