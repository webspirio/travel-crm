// ISO-3166 alpha-2 → display name. Limited to the codes we expect for
// AnyTour (German bus tours to Italy, with Ukrainian and German staff).
// Unknown codes fall through as the raw 2-letter string so the UI never
// renders empty — the hotel still has a country, we just haven't named
// it yet. Add codes here as new origin/destination markets come online.

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  AT: "Austria",
  CH: "Switzerland",
  CZ: "Czech Republic",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  HR: "Croatia",
  IT: "Italy",
  NL: "Netherlands",
  PL: "Poland",
  SI: "Slovenia",
  UA: "Ukraine",
}

export function countryCodeToName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code
}
