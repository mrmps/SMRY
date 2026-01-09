import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/clerk-react'
import { DefaultCatchBoundary } from '@/components/system/DefaultCatchBoundary'
import { NotFound } from '@/components/shared/not-found'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryProvider } from '@/components/shared/query-provider'
import { env } from '@/lib/env'
import { IntlProvider, type Messages } from '@/i18n/provider'
import { defaultLocale } from '@/i18n/config'
import defaultMessages from '@/messages/en.json'
import appCss from '@/styles/app.css?url'
import { siteConfig } from '@/config/site'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'

const baseMessages = defaultMessages as Messages
const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: siteConfig.name },
      {
        name: 'description',
        content: siteConfig.description,
      },
      {
        property: 'og:title',
        content: siteConfig.name,
      },
      {
        property: 'og:description',
        content: siteConfig.description,
      },
      {
        property: 'og:image',
        content: siteConfig.ogImage,
      },
      {
        property: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/favicon.ico' },
    ],
    scripts: [
      {
        src: 'https://www.googletagmanager.com/gtag/js?id=G-RFC55FX414',
        async: true,
      },
      {
        children:
          "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-RFC55FX414');",
      },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <html lang={defaultLocale} className="bg-background" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="bg-background text-foreground" suppressHydrationWarning>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <QueryProvider>
              <NuqsAdapter>
                <IntlProvider locale={defaultLocale} messages={baseMessages}>
                  <Outlet />
                </IntlProvider>
              </NuqsAdapter>
            </QueryProvider>
          </ThemeProvider>
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  )
}
