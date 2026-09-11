import { createServer } from 'node:http'
import { createApp } from './app.js'
import { createDrizzleStores } from './auth/repositoryDrizzle.js'
import { createMemoryStores } from './auth/repositoryMemory.js'
import { loadConfig } from './config.js'
import { getDb } from './db/client.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const stores = process.env.DATABASE_URL
    ? createDrizzleStores(getDb(process.env.DATABASE_URL).db)
    : createMemoryStores()
  if (!process.env.DATABASE_URL) {
    process.stderr.write(
      'WARN tally-api: DATABASE_URL is unset; using in-memory stores (development only).\n',
    )
  }
  const app = createApp(config, stores)
  const port = Number(process.env.PORT ?? 4000)
  const server = createServer((req, res) => {
    void app.handle(req, res)
  })
  server.listen(port, () => {
    process.stdout.write(
      JSON.stringify({ at: new Date().toISOString(), kind: 'startup', port, env: config.nodeEnv }) + '\n',
    )
  })
}

void main()
