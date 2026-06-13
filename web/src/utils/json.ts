export function parseJsonObject(text: string, fallbackName = 'JSON') {
  const value = JSON.parse(text) as unknown;
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${fallbackName} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

export function parseJsonArray<T = unknown>(text: string, fallbackName = 'JSON') {
  const value = JSON.parse(text) as unknown;
  if (!Array.isArray(value)) {
    throw new Error(`${fallbackName} 必须是数组`);
  }
  return value as T[];
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function compactJson(value: unknown) {
  return JSON.stringify(value);
}