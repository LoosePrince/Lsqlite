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

export const databaseListQuerySchema = z.object({
  status: z.enum(['active', 'disabled', 'deleted', 'all']).default('active')
});

export const rotateKeySchema = z.object({
  key: z.string().min(12).max(256).optional()
});

export const permanentDeleteSchema = z.object({
  confirmName: z.string().min(1)
});

export const querySchema = z.object({
  sql: z.string().min(1),
  params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  mode: z.enum(['auto', 'read', 'write']).default('auto')
});

export const transactionSchema = z.object({
  statements: z.array(querySchema).min(1).max(100)
});

export const identifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const columnSchema = z.object({
  name: identifierSchema,
  type: z.enum(['integer', 'real', 'text', 'blob', 'numeric', 'boolean', 'datetime']),
  primaryKey: z.boolean().optional(),
  notNull: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.string().max(200).optional()
});

export const createTableSchema = z.object({
  name: identifierSchema,
  columns: z.array(columnSchema).min(1).max(80),
  ifNotExists: z.boolean().optional()
});

export const dropTableSchema = z.object({
  confirmName: identifierSchema
});

export const addColumnSchema = columnSchema;

export const createIndexSchema = z.object({
  name: identifierSchema,
  columns: z.array(identifierSchema).min(1).max(20),
  unique: z.boolean().optional()
});

export const rowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  orderBy: identifierSchema.optional(),
  order: z.enum(['asc', 'desc']).default('asc')
});

export const insertRowSchema = z.object({
  values: z.record(z.string(), z.unknown())
});

export const updateRowsSchema = z.object({
  values: z.record(z.string(), z.unknown()),
  where: z.record(z.string(), z.unknown())
});

export const deleteRowsSchema = z.object({
  where: z.record(z.string(), z.unknown())
});

export const auditQuerySchema = z.object({
  databaseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});