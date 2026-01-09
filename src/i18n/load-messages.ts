import { Locale, defaultLocale } from './config'
import type { Messages } from './provider'

type Loader = () => Promise<Messages>

const loaders: Record<Locale, Loader> = {
  en: () => import('@/messages/en.json').then((mod) => mod.default),
  pt: () => import('@/messages/pt.json').then((mod) => mod.default),
  de: () => import('@/messages/de.json').then((mod) => mod.default),
  zh: () => import('@/messages/zh.json').then((mod) => mod.default),
  es: () => import('@/messages/es.json').then((mod) => mod.default),
  nl: () => import('@/messages/nl.json').then((mod) => mod.default),
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const loader = loaders[locale] ?? loaders[defaultLocale]
  return loader()
}
