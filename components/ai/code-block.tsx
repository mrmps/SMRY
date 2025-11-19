"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Copy } from "lucide-react"

const CodeBlockContext = React.createContext<{ code: string } | null>(null)

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string
  language: string
}

export function CodeBlock({ className, code, language, children, ...props }: CodeBlockProps) {
  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className={cn("relative overflow-hidden rounded-lg border bg-zinc-950 text-zinc-50 dark:bg-zinc-900", className)} {...props}>
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 text-xs text-zinc-400 dark:bg-zinc-950">
          <span className="font-medium">{language}</span>
          {children}
        </div>
        <div className="overflow-x-auto p-4">
          <pre className="font-mono text-sm">
            {/* eslint-disable-next-line tailwindcss/no-custom-classname */}
            <code className={`language-${language}`}>{code}</code>
          </pre>
        </div>
      </div>
    </CodeBlockContext.Provider>
  )
}

interface CodeBlockCopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> {
  onCopy?: () => void
  onError?: (error: Error) => void
}

export function CodeBlockCopyButton({ onCopy, onError, className, ...props }: CodeBlockCopyButtonProps) {
  const context = React.useContext(CodeBlockContext)
  const [isCopied, setIsCopied] = React.useState(false)

  const handleCopy = async () => {
    if (!context?.code) return

    try {
      await navigator.clipboard.writeText(context.code)
      setIsCopied(true)
      onCopy?.()
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("Failed to copy"))
    }
  }

  return (
    <button
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      onClick={handleCopy}
      type="button"
      {...props}
    >
      {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span className="sr-only">Copy code</span>
    </button>
  )
}

