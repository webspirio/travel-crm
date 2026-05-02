import type { TFunction } from "i18next"
import { Mail, Pencil, Phone } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Client } from "@/types"

interface Props {
  client: Client | null | undefined
  t: TFunction<"booking">
  /** When provided AND the client is loaded, renders an Edit button in the header. */
  onEdit?: () => void
}

/**
 * Client section — name (link to record), email (mailto), phone (tel),
 * nationality. T9 attaches the frictionless inline-edit affordance via the
 * optional `onEdit` callback. Contact edits are always allowed regardless
 * of booking status.
 */
export function ClientCard({ client, t, onEdit }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("detail.sections.client")}</CardTitle>
        {onEdit && client && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            {t("detail.edit.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!client ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("detail.client.name")}</dt>
            <dd>
              <Link
                to={`/clients/${client.id}`}
                className="font-medium hover:underline"
              >
                {client.firstName} {client.lastName}
              </Link>
            </dd>

            {client.email && (
              <>
                <dt className="text-muted-foreground">{t("detail.client.email")}</dt>
                <dd>
                  <a
                    href={`mailto:${client.email}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Mail className="size-3" />
                    {client.email}
                  </a>
                </dd>
              </>
            )}

            {client.phone && (
              <>
                <dt className="text-muted-foreground">{t("detail.client.phone")}</dt>
                <dd>
                  <a
                    href={`tel:${client.phone}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Phone className="size-3" />
                    {client.phone}
                  </a>
                </dd>
              </>
            )}

            {client.nationality && (
              <>
                <dt className="text-muted-foreground">{t("detail.client.nationality")}</dt>
                <dd>{client.nationality}</dd>
              </>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
