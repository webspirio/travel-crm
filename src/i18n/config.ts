import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import commonUk from "./locales/uk/common.json"
import commonDe from "./locales/de/common.json"
import dashboardUk from "./locales/uk/dashboard.json"
import dashboardDe from "./locales/de/dashboard.json"
import tripsUk from "./locales/uk/trips.json"
import tripsDe from "./locales/de/trips.json"
import clientsUk from "./locales/uk/clients.json"
import clientsDe from "./locales/de/clients.json"
import bookingUk from "./locales/uk/booking.json"
import bookingDe from "./locales/de/booking.json"

export const SUPPORTED_LANGUAGES = ["uk", "de"] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uk: {
        common: commonUk,
        dashboard: dashboardUk,
        trips: tripsUk,
        clients: clientsUk,
        booking: bookingUk,
      },
      de: {
        common: commonDe,
        dashboard: dashboardDe,
        trips: tripsDe,
        clients: clientsDe,
        booking: bookingDe,
      },
    },
    fallbackLng: "uk",
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: ["common", "dashboard", "trips", "clients", "booking"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "anytour-lang",
    },
  })

export default i18n
