import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { IntlProvider, type Messages } from '@/i18n/provider'
import { isLocale, defaultLocale, type Locale } from '@/i18n/config'
import { loadMessages } from '@/i18n/load-messages'
import { useEffect } from 'react'
import defaultMessages from '@/messages/en.json'

interface LocaleLoaderData {
  locale: Locale
  messages: Messages
}

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    const localeParam = params.locale ?? defaultLocale
    if (!isLocale(localeParam)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound()
    }
  },
  loader: async ({ params }): Promise<LocaleLoaderData> => {
    const localeParam = params.locale ?? defaultLocale
    const messages = await loadMessages(localeParam as Locale)
    return { locale: localeParam as Locale, messages: messages }
  },
  component: LocaleLayout,
})

function LocaleLayout() {
  const loaderData = Route.useLoaderData()
  const locale = loaderData?.locale ?? defaultLocale
  const messages = (loaderData?.messages ?? defaultMessages)

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  return (
    <IntlProvider locale={locale} messages={messages}>
      <Outlet />
    </IntlProvider>
  )
}
