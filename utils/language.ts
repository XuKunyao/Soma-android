import type { LanguagePreference, ResolvedLanguage } from '@/utils/storage';

export function getSystemLanguage(): ResolvedLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

export function resolveLanguagePreference(language: LanguagePreference): ResolvedLanguage {
  return language === 'system' ? getSystemLanguage() : language;
}
