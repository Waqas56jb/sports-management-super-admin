import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from '@/i18n/en.js';
import fr from '@/i18n/fr.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
];

const DICTIONARIES = { en, fr };
const STORAGE_KEY = 'shf.lang';
const I18nContext = createContext(null);

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => (params[name] !== undefined && params[name] !== null ? String(params[name]) : `{${name}}`));
}

/** Translate in a specific language outside the current render (e.g. right after switching). */
export function translateIn(lang, key, params) {
  const value = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.en, key);
  return typeof value === 'string' ? interpolate(value, params) : key;
}

function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTIONARIES[stored]) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const plural = useMemo(() => new Intl.PluralRules(lang === 'fr' ? 'fr-FR' : 'en-GB'), [lang]);

  /**
   * t('players.title') · t('common.showing', { from, to, total })
   * Plural entries are objects: { one: '{count} player', other: '{count} players' }.
   */
  const t = useCallback(
    (key, params) => {
      if (!key) return '';
      let value = lookup(DICTIONARIES[lang], key);
      if (value === undefined) value = lookup(DICTIONARIES.en, key);
      if (value === undefined) {
        if (import.meta.env.DEV) console.warn(`[i18n] Missing key: ${key}`);
        return key;
      }
      if (value && typeof value === 'object' && ('other' in value || 'one' in value)) {
        const count = Number(params?.count ?? 0);
        const form = count === 0 && value.zero ? 'zero' : plural.select(count);
        value = value[form] ?? value.other;
      }
      return typeof value === 'string' ? interpolate(value, params) : key;
    },
    [lang, plural],
  );

  /** Whether a key exists (used for optional translated descriptions). */
  const has = useCallback((key) => lookup(DICTIONARIES[lang], key) !== undefined, [lang]);

  const value = useMemo(() => ({ lang, setLang: setLangState, t, has }), [lang, t, has]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Translate an ApiError / validation descriptor into a message. */
export function useErrorMessage() {
  const { t } = useI18n();
  return useCallback(
    (error) => {
      if (!error) return '';
      if (typeof error === 'string') return t(error);
      if (error.key) return t(error.key, error.params);
      if (error.code) return t(error.code);
      return t('errors.generic');
    },
    [t],
  );
}
