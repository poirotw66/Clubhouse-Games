import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getLocale, setLocale as persistLocale, type Locale } from '../utils/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getLocale());

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
