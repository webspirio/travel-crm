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
import hotelsUk from "./locales/uk/hotels.json"
import hotelsDe from "./locales/de/hotels.json"
import calendarUk from "./locales/uk/calendar.json"
import calendarDe from "./locales/de/calendar.json"
import financeUk from "./locales/uk/finance.json"
import financeDe from "./locales/de/finance.json"
import managersUk from "./locales/uk/managers.json"
import managersDe from "./locales/de/managers.json"

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
        hotels: hotelsUk,
        calendar: calendarUk,
        finance: financeUk,
        managers: managersUk,
      },
      de: {
        common: commonDe,
        dashboard: dashboardDe,
        trips: tripsDe,
        clients: clientsDe,
        booking: bookingDe,
        hotels: hotelsDe,
        calendar: calendarDe,
        finance: financeDe,
        managers: managersDe,
      },
    },
    fallbackLng: "uk",
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    ns: [
      "common",
      "dashboard",
      "trips",
      "clients",
      "booking",
      "hotels",
      "calendar",
      "finance",
      "managers",
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "anytour-lang",
    },
  })

export default i18n
