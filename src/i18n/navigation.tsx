import { Link, type LinkProps } from '@tanstack/react-router'
import { defaultLocale, type Locale } from './config'
import { useLocale } from './provider'
import type { AnchorHTMLAttributes } from 'react'

// Allow all standard anchor attributes plus TanStack Router LinkProps
export interface LocalizedLinkProps extends Omit<LinkProps, 'to'>,
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
    to?: string
    locale?: Locale
  }

export function LocalizedLink({ locale, to, className, style, title, ...rest }: LocalizedLinkProps) {
  const currentLocale = useLocale()
  const activeLocale = locale ?? currentLocale

  // Handle undefined or string paths
  const path = to ?? '/'

  if (typeof path === 'string') {
    return (
      <Link
        to={withLocalePrefix(path, activeLocale) as LinkProps['to']}
        className={className}
        style={style}
        title={title}
        {...rest}
      />
    )
  }

  return (
    <Link
      to={path}
      className={className}
      style={style}
      title={title}
      {...rest}
    />
  )
}

export function withLocalePrefix(path: string, locale: Locale) {
  if (!path?.startsWith('/')) return path
  if (locale === defaultLocale) return path
  if (path === '/') {
    return `/${locale}`
  }
  if (path.startsWith(`/${locale}`)) {
    return path
  }
  return `/${locale}${path}`
}

// Alias for backwards compatibility with existing imports
export { LocalizedLink as Link }
