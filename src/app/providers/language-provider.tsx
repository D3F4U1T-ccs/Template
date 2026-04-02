import { useMemo, useState, type ReactNode } from "react";

import { LanguageProviderContext } from "@/app/providers/language-context";
import type { LanguageCode } from "@/types/models";

type LanguageProviderProps = {
  children: ReactNode;
  defaultLanguage?: LanguageCode;
  storageKey?: string;
};

function detectInitialLanguage(defaultLanguage: LanguageCode, storageKey: string) {
  const stored = localStorage.getItem(storageKey) as LanguageCode | null;

  if (stored === "ru" || stored === "en") {
    return stored;
  }

  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : defaultLanguage;
}

export function LanguageProvider({
  children,
  defaultLanguage = "en",
  storageKey = "twiki-language",
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>(() =>
    detectInitialLanguage(defaultLanguage, storageKey)
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage: (nextLanguage: LanguageCode) => {
        localStorage.setItem(storageKey, nextLanguage);
        setLanguageState(nextLanguage);
      },
    }),
    [language, storageKey]
  );

  return (
    <LanguageProviderContext.Provider value={value}>
      {children}
    </LanguageProviderContext.Provider>
  );
}
