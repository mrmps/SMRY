"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeOption {
  id: string;
  name: string;
  bg: string;
  text: string;
  accent: string;
}

const themes: ThemeOption[] = [
  { id: "system", name: "System", bg: "#f5f5f5", text: "#2e2f30", accent: "#5e69d1" },
  { id: "light", name: "Light", bg: "#fcfcfc", text: "#2e2f30", accent: "#5e69d1" },
  { id: "pure-light", name: "Pure Light", bg: "#ffffff", text: "#1a1a1a", accent: "#6366f1" },
  { id: "dark", name: "Dark", bg: "#09090b", text: "#fafafa", accent: "#5e69d1" },
  { id: "magic-blue", name: "Magic Blue", bg: "#191a22", text: "#e4e4ed", accent: "#575ac6" },
  { id: "classic-dark", name: "Classic Dark", bg: "#1e2022", text: "#e4e5e9", accent: "#5e69d1" },
];

function ThemeSwatch({ theme }: { theme: ThemeOption }) {
  return (
    <span
      className="inline-flex h-[22px] w-[34px] items-center justify-center rounded text-[11px] font-medium"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        border: `0.5px solid ${theme.id.includes('dark') || theme.id === 'magic-blue' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      }}
    >
      <span style={{ color: theme.accent }}>A</span>
      <span>a</span>
    </span>
  );
}

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={buttonVariants({ variant: "outline", size: "icon" })}>
        <div className="h-4 w-4" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark" ||
    resolvedTheme === "magic-blue" ||
    resolvedTheme === "classic-dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger id="theme-menu-trigger" className={buttonVariants({ variant: "outline", size: "icon" })}>
        <Sun className={cn("h-4 w-4 transition-transform", isDark ? "scale-0" : "scale-100")} />
        <Moon className={cn("absolute h-4 w-4 transition-transform", isDark ? "scale-100" : "scale-0")} />
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="flex items-center gap-2"
          >
            <ThemeSwatch theme={t} />
            <span className="flex-1 text-[13px]">{t.name}</span>
            {theme === t.id && (
              <Check className="h-4 w-4 opacity-60" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
