export type Locale = 'en' | 'zh';

export type TranslationValues = Record<string, string | number>;

export type TranslationTree = {
  [key: string]: string | TranslationTree;
};

export type TranslateFn = (key: string, values?: TranslationValues) => string;
