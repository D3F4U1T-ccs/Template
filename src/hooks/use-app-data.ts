import { useContext } from "react";

import { AppDataContext } from "@/app/providers/app-data-provider";

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }

  return context;
}
