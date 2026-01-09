import { ReactNode, createContext, useContext, useMemo } from 'react'
import { Locale, defaultLocale } from './config'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Messages = Record<string, {}>

interface IntlContextValue {
  locale: Locale
  messages: Messages
}

const IntlContext = createContext<IntlContextValue>({
  locale: defaultLocale,
  messages: {},
})

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: Messages
  children: ReactNode
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages])
  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>
}

function useIntlContext() {
  return useContext(IntlContext)
}

function getMessage(messages: Messages, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, messages) as string | undefined
}

function formatMessage(
  template: string,
  values?: Record<string, string | number>,
) {
  if (!values) return template
  return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const key = token.trim()
    if (!key.length) return ''
    const value = values[key]
    return value == null ? '' : String(value)
  })
}

export function useTranslations(namespace?: string) {
  const { messages } = useIntlContext()

  return (key: string, values?: Record<string, string | number>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key
    const template = getMessage(messages, fullKey)
    if (typeof template !== 'string') {
      return fullKey
    }
    return formatMessage(template, values)
  }
}

export function useLocale() {
  return useIntlContext().locale
}
