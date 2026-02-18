"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { initializeReaderPreferences } from "@/lib/hooks/use-reader-preferences"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  // Initialize reader preferences CSS variables on first mount
  // This applies stored preferences before React hydrates to avoid FOUC
  React.useEffect(() => {
    initializeReaderPreferences()
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

