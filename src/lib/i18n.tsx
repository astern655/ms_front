import { createContext, useContext, type ReactNode } from 'react'

export type Lang = 'ko' | 'en'

const LangCtx = createContext<Lang>('ko')

export function LangProvider({ value, children }: { value: Lang; children: ReactNode }) {
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

export function useLang(): Lang {
  return useContext(LangCtx)
}

// Inline bilingual translator: t('한국어', 'English'). No key registry — a 2-language app
// reads best with both strings at the call site.
export function useT(): (ko: string, en: string) => string {
  const lang = useContext(LangCtx)
  return (ko, en) => (lang === 'en' ? en : ko)
}

// Browser default before a profile (and its language) is loaded.
export function browserLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')
    ? 'en'
    : 'ko'
}
