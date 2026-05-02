/**
 * Curated label keys for audit-log fields.
 *
 * Acts as a hard allow-list: the History tab calls `auditFieldLabel(table, key)`
 * for every changed field and skips any that returns undefined. Adding a column
 * to a tracked table does NOT auto-leak the column to the timeline — the column
 * has to be added here, intentionally. System fields (id, tenant_id, timestamps)
 * are always skipped via the SKIP set.
 */
export type AuditEntityTable = "bookings" | "booking_passengers" | "payments"

const SKIP = new Set(["id", "tenant_id", "created_at", "updated_at", "deleted_at"])

const BOOKINGS_FIELDS: Record<string, string | undefined> = {
  notes: "detail.history.fields.bookings.notes",
  due_date: "detail.history.fields.bookings.dueDate",
  total_price_eur: "detail.history.fields.bookings.totalPriceEur",
  paid_amount_eur: "detail.history.fields.bookings.paidAmountEur",
  status: "detail.history.fields.bookings.status",
  operator_ref: "detail.history.fields.bookings.operatorRef",
  invoice_number: "detail.history.fields.bookings.invoiceNumber",
  commission_eur: "detail.history.fields.bookings.commissionEur",
  contract_number: "detail.history.fields.bookings.contractNumber",
  client_id: "detail.history.fields.bookings.clientId",
  trip_id: "detail.history.fields.bookings.tripId",
  sold_by_manager_id: "detail.history.fields.bookings.soldByManagerId",
}

const PASSENGERS_FIELDS: Record<string, string | undefined> = {
  first_name: "detail.history.fields.passengers.firstName",
  last_name: "detail.history.fields.passengers.lastName",
  birth_date: "detail.history.fields.passengers.birthDate",
  seat_number: "detail.history.fields.passengers.seatNumber",
  hotel_id: "detail.history.fields.passengers.hotelId",
  room_type: "detail.history.fields.passengers.roomType",
  price_total_eur: "detail.history.fields.passengers.priceTotalEur",
  price_breakdown: "detail.history.fields.passengers.priceBreakdown",
  special_notes: "detail.history.fields.passengers.specialNotes",
  kind: "detail.history.fields.passengers.kind",
  client_id: "detail.history.fields.passengers.clientId",
  // Foreign keys we never want to surface as raw uuids — never edited by user.
  booking_id: undefined,
  trip_id: undefined,
}

const PAYMENTS_FIELDS: Record<string, string | undefined> = {
  amount_eur: "detail.history.fields.payments.amountEur",
  method: "detail.history.fields.payments.method",
  received_at: "detail.history.fields.payments.receivedAt",
  reference: "detail.history.fields.payments.reference",
  notes: "detail.history.fields.payments.notes",
  received_by_manager_id: "detail.history.fields.payments.receivedByManagerId",
  booking_id: undefined,
}

const TABLES: Record<AuditEntityTable, Record<string, string | undefined>> = {
  bookings: BOOKINGS_FIELDS,
  booking_passengers: PASSENGERS_FIELDS,
  payments: PAYMENTS_FIELDS,
}

/**
 * Resolve an i18n key for `(table, column)`, or `undefined` to hide the field.
 * Returns undefined for: system fields (SKIP), columns not in the curated map,
 * and columns explicitly mapped to `undefined` (e.g. foreign-key uuids that
 * carry no user value).
 */
export function auditFieldLabel(
  table: AuditEntityTable,
  column: string,
): string | undefined {
  if (SKIP.has(column)) return undefined
  return TABLES[table]?.[column]
}
