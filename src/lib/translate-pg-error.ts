import type { TFunction } from "i18next"

/**
 * Narrowed shape that covers both PostgrestError and plain Error objects
 * thrown from mutationFn helpers (e.g. new Error("no_session")).
 */
interface ErrorLike {
  code?: string
  message?: string
}

/** Type guard — accepts any unknown value and returns true if it looks like
 *  a Postgres / Supabase error (has at least a message string). */
function isErrorLike(err: unknown): err is ErrorLike {
  return (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>)["message"] === "string"
  )
}

/**
 * Maps known Postgres error codes and constraint names to i18n keys and
 * returns the translated string via the caller-supplied `t` function.
 *
 * Usage (inside a mutation's onError callback):
 *   const { t } = useTranslation()
 *   toast.error(translatePgError(error, t))
 *
 * @param err  - The error thrown by a Supabase / Postgres call (unknown).
 * @param t    - The TFunction from useTranslation(); must resolve "common" NS.
 * @returns      A localised, human-readable error string.
 */
export function translatePgError(err: unknown, t: TFunction): string {
  // Handle bare string errors
  if (typeof err === "string") {
    return err || t("errors.unknown")
  }

  if (!isErrorLike(err)) {
    return t("errors.unknown")
  }

  const { code, message = "" } = err

  // Bare application-level sentinels thrown directly as new Error(...)
  if (message === "no_session") return t("errors.sessionExpired")
  if (message === "no_manager") return t("errors.notAManager")

  switch (code) {
    // 23505 — unique_violation
    case "23505":
      if (message.includes("clients_tenant_email_uniq"))
        return t("errors.duplicateEmail")
      if (message.includes("bookings_tenant_booking_number_uniq"))
        return t("errors.bookingNumberRace")
      if (message.startsWith("duplicate seat in same booking"))
        return t("errors.seatDupInDraft")
      break

    // 23503 — foreign_key_violation (composite seat FK on booking_passengers)
    case "23503":
      if (message.includes("trip_id_seat_number_fkey"))
        return t("errors.seatTaken")
      break

    // 23514 — check_violation (lap-infant guard)
    case "23514":
      if (message.includes("kind = 'infant'"))
        return t("errors.lapInfantNeedsSeat")
      break

    // 42501 — insufficient_privilege (RLS, status-machine, immutability triggers)
    case "42501":
      if (message.includes("cross-tenant")) return t("errors.crossTenant")
      if (message.includes("illegal booking_status"))
        return t("errors.illegalStatus")
      return t("errors.permissionDenied")

    // 22023 — invalid_parameter_value (empty passengers array guard)
    case "22023":
      return t("errors.emptyPassengers")

    default:
      break
  }

  // Fallback: surface the raw message if one exists, otherwise use generic key
  return message.length > 0 ? message : t("errors.unknown")
}
