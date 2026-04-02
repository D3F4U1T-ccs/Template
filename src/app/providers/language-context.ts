import { createContext } from "react";

import type { LanguageCode } from "@/types/models";

export type LanguageProviderState = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

export const LanguageProviderContext = createContext<
  LanguageProviderState | undefined
>(undefined);
