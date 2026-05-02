import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

// Re-export CountryCode so callers don't need to import from the library directly.
export type { CountryCode }

/**
 * Normalise a free-form phone string to E.164 (e.g. "+493011223344").
 * Returns null when the input cannot be parsed as a valid number for the
 * given country (or any country if `country` is omitted).
 */
export function toE164(value: string, country?: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(value, country)
  if (!parsed || !parsed.isValid()) return null
  return parsed.format("E.164")
}

/**
 * Pick the default country for a phone-input based on a manager / client's
 * declared nationality. Defaults to "DE" (project's primary market).
 *
 * "UA" → "UA"
 * "DE" → "DE"
 * anything else / null → "DE"
 */
export function defaultCountryFor(
  nationality: string | null | undefined,
): CountryCode {
  if (nationality === "UA") return "UA"
  if (nationality === "DE") return "DE"
  return "DE"
}
