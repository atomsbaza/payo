import { config } from 'dotenv'
import type { Config } from 'drizzle-kit'

config({ path: '.env.local' })

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  connectionString: process.env.DATABASE_URL!,
} satisfies Config
