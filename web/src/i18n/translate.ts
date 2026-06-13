import type { Locale, TranslationTree, TranslationValues, TranslateFn } from './types.js';
import { en } from './locales/en.js';
import { zh } from './locales/zh.js';

const dictionaries: Record<Locale, TranslationTree> = { en, zh };

function resolve(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = values[name];
    return value === undefined ? `{{${name}}}` : String(value);
  });
}

export function createTranslator(locale: Locale): TranslateFn {
  const tree = dictionaries[locale];
  return (key, values) => interpolate(resolve(tree, key) ?? key, values);
}
