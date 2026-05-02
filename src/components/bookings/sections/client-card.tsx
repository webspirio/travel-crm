import type { TFunction } from "i18next"
import { Mail, Phone } from "lucide-react"
import { Link } from "react-router"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Client } from "@/types"

interface Props {
  client: Client | null | undefined
  t: TFunction<"booking">
}

/**
 * Client section — name (link to record), email (mailto), phone (tel),
 * nationality. Pure display; T9 attaches the inline-edit affordance.
 */
export function ClientCard({ client, t }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.sections.client")}</CardTitle>
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
