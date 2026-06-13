import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const createDatabaseSchema = z.object({
  name: z.string().min(1).max(120),
  key: z.string().min(12).max(256).optional(),
  note: z.string().max(500).optional()
});

export const updateDatabaseSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'disabled']).optional()
});

export const rotateKeySchema = z.object({
  key: z.string().min(12).max(256).optional()
});

export const querySchema = z.object({
  sql: z.string().min(1),
  params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  mode: z.enum(['auto', 'read', 'write']).default('auto')
});

export const transactionSchema = z.object({
  statements: z.array(querySchema).min(1).max(100)
});