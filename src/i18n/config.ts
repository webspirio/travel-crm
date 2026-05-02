import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import commonUk from "./locales/uk/common.json"
import commonDe from "./locales/de/common.json"
import authUk from "./locales/uk/auth.json"
import authDe from "./locales/de/auth.json"
import dashboardUk from "./locales/uk/dashboard.json"
import dashboardDe from "./locales/de/dashboard.json"
import tripsUk from "./locales/uk/trips.json"
import tripsDe from "./locales/de/trips.json"
import clientsUk from "./locales/uk/clients.json"
import clientsDe from "./locales/de/clients.json"
import bookingUk from "./locales/uk/booking.json"
import bookingDe from "./locales/de/booking.json"
import bookingsUk from "./locales/uk/bookings.json"
import bookingsDe from "./locales/de/bookings.json"
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
        auth: authUk,
        common: commonUk,
        dashboard: dashboardUk,
        trips: tripsUk,
        clients: clientsUk,
        booking: bookingUk,
        bookings: bookingsUk,
        hotels: hotelsUk,
        calendar: calendarUk,
        finance: financeUk,
        managers: managersUk,
      },
      de: {
        auth: authDe,
        common: commonDe,
        dashboard: dashboardDe,
        trips: tripsDe,
        clients: clientsDe,
        booking: bookingDe,
        bookings: bookingsDe,
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
      "auth",
      "common",
      "dashboard",
      "trips",
      "clients",
      "booking",
      "bookings",
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
