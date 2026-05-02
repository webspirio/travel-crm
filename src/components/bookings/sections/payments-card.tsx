import type { TFunction } from "i18next"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Payment } from "@/hooks/queries/use-payments"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Locale, Manager } from "@/types"

interface Props {
  payments: Payment[]
  managerById: Map<string, Manager>
  onRecordPayment: () => void
  t: TFunction<"booking">
  locale: Locale
}

/**
 * Payments — list of receipts/refunds plus the "Record payment" CTA.
 * Owns no state; the parent controls the dialog and supplies the open
 * handler.
 */
export function PaymentsCard({ payments, managerById, onRecordPayment, t, locale }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("detail.sections.payments")}</CardTitle>
        <Button size="sm" onClick={onRecordPayment}>
          {t("detail.payments.record")}
        </Button>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.payments.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.payments.date")}</TableHead>
                <TableHead className="text-right">{t("detail.payments.amount")}</TableHead>
                <TableHead>{t("detail.payments.method")}</TableHead>
                <TableHead>{t("detail.payments.reference")}</TableHead>
                <TableHead>{t("detail.payments.recordedBy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((pay) => {
                const recorder = pay.receivedByManagerId
                  ? managerById.get(pay.receivedByManagerId)
                  : undefined
                return (
                  <TableRow key={pay.id}>
                    <TableCell className="tabular-nums">
                      {formatDate(pay.receivedAt, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(pay.amountEur, locale)}
                    </TableCell>
                    <TableCell>{t(`detail.payments.${pay.method}`)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {pay.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {recorder?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
