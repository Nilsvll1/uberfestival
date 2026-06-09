"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type Language,
  type Translations,
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  getTranslations,
  isValidLanguage,
} from "../../lib/i18n";

type I18nContextValue = {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18nContext must be used inside I18nProvider");
  return ctx;
}

export default function I18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang: Language;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Language>(initialLang);

  // Sync with localStorage on mount (client overrides server if they differ)
  useEffect(() => {
    const stored = localStorage.getItem(LANG_COOKIE) ?? undefined;
    if (isValidLanguage(stored) && stored !== lang) {
      setLangState(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback(
    (next: Language) => {
      setLangState(next);
      localStorage.setItem(LANG_COOKIE, next);
      // Write cookie so Server Components can read the new language on next render
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      // Re-render Server Components (Header labels, detail page text, etc.)
      router.refresh();
    },
    [router]
  );

  return (
    <I18nContext.Provider value={{ lang, t: getTranslations(lang), setLang }}>
      {children}
    </I18nContext.Provider>
  );
}
