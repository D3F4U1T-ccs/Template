import { useContext } from "react";

import { LanguageProviderContext } from "@/app/providers/language-context";

export function useLanguage() {
  const context = useContext(LanguageProviderContext);

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
}
