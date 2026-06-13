const dangerousPatterns = [
  /\battach\b/i,
  /\bdetach\b/i,
  /\bvacuum\s+into\b/i,
  /\bpragma\s+writable_schema\b/i,
  /\bload_extension\s*\(/i
];

export function splitSqlStatements(sql: string) {
  const statements: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | 'backtick' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (quote === 'single') {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (char === "'") {
        quote = null;
      }
      continue;
    }

    if (quote === 'double') {
      current += char;
      if (char === '"') quote = null;
      continue;
    }

    if (quote === 'backtick') {
      current += char;
      if (char === '`') quote = null;
      continue;
    }

    if (char === "'") quote = 'single';
    if (char === '"') quote = 'double';
    if (char === '`') quote = 'backtick';

    if (char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') {
        current += sql[index];
        index += 1;
      }
      continue;
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

export function normalizeSql(sql: string) {
  return sql
    .trim()
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/\bserial\b/gi, 'integer')
    .replace(/\bbigserial\b/gi, 'integer')
    .replace(/\bboolean\b/gi, 'integer')
    .replace(/\btrue\b/gi, '1')
    .replace(/\bfalse\b/gi, '0')
    .replace(/\bnow\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bcurrent_timestamp\s*\(\s*\)/gi, "CURRENT_TIMESTAMP")
    .replace(/\bauto_increment\b/gi, 'autoincrement')
    .replace(/\s+returning\s+\*\s*$/i, '');
}

export function validateSql(sql: string, options: { allowDangerous?: boolean } = {}) {
  if (!sql.trim()) {
    throw Object.assign(new Error('sql is required'), { status: 400 });
  }

  if (!options.allowDangerous) {
    const found = dangerousPatterns.find((pattern) => pattern.test(sql));
    if (found) {
      throw Object.assign(new Error('sql statement is not allowed by safety policy'), { status: 403 });
    }
  }

  return sql;
}

export function isReadOnlySql(sql: string) {
  return /^\s*(select|with|pragma\s+table_info|pragma\s+index_list|pragma\s+foreign_key_list)\b/i.test(sql);
}