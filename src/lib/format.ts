import type { Locale } from "@/types"

const LOCALE_MAP: Record<Locale, string> = {
  uk: "uk-UA",
  de: "de-DE",
}

export function formatCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatDateRange(start: Date, end: Date, locale: Locale): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const startFmt = new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "2-digit",
    month: "short",
    year: sameYear ? undefined : "numeric",
  })
  const endFmt = new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  return `${startFmt.format(start)} – ${endFmt.format(end)}`
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value / 100)
}
