import { useI18n } from '@/i18n';

/** Current language + setter (English default, French secondary). */
export function useLanguage() {
  const { lang, setLang } = useI18n();
  return { language: lang, setLanguage: setLang };
}
