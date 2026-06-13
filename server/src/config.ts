import path from 'node:path';
import process from 'node:process';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SITE_DB_PATH: z.string().min(1).default('./data/site.sqlite'),
  DATA_DIR: z.string().min(1).default('./data/databases'),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().optional()
});

export type AppConfig = z.infer<typeof envSchema> & {
  siteDbPath: string;
  dataDir: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const siteDbPath = path.resolve(parsed.SITE_DB_PATH);
  const dataDir = path.resolve(parsed.DATA_DIR);

  return {
    ...parsed,
    siteDbPath,
    dataDir
  };
}