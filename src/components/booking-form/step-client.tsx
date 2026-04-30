import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useClients } from "@/hooks/queries/use-clients"
import { useBookingStore } from "@/stores/booking-store"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

export function StepClient() {
  const { t } = useTranslation("booking")
  const { clientId, newClient, update } = useBookingStore()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(Boolean(newClient))

  const { data: clients = [] } = useClients()

  const filtered = query
    ? clients
        .filter((c) =>
          `${c.firstName} ${c.lastName} ${c.email}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : clients.slice(0, 8)

  if (creating) {
    const draft = newClient ?? {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      nationality: "UA" as const,
    }
    const setField = (k: keyof typeof draft, v: string) =>
      update({
        newClient: { ...draft, [k]: v },
        clientId: null,
      })

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>{t("client.createNew")}</Label>
          <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
            ←
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">{t("client.firstName")}</Label>
            <Input
              id="firstName"
              value={draft.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">{t("client.lastName")}</Label>
            <Input
              id="lastName"
              value={draft.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("client.email")}</Label>
            <Input
              id="email"
              type="email"
              value={draft.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("client.phone")}</Label>
            <Input
              id="phone"
              type="tel"
              value={draft.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("client.nationality")}</Label>
            <Select
              value={draft.nationality}
              onValueChange={(v) => {
                if (v === "UA" || v === "DE") setField("nationality", v)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UA">🇺🇦 Україна</SelectItem>
                <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    )
  }

  const selected = clients.find((c) => c.id === clientId)

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="clientSearch">{t("client.searchLabel")}</Label>
          <Input
            id="clientSearch"
            placeholder={t("client.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setCreating(true)
            update({
              newClient: {
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                nationality: "UA",
              },
              clientId: null,
            })
          }}
        >
          {t("client.createNew")}
        </Button>
      </div>

      <ul className="divide-y rounded-md border">
        {filtered.map((c) => {
          const isSelected = c.id === clientId
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => update({ clientId: c.id, newClient: undefined })}
                className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent ${
                  isSelected ? "bg-accent" : ""
                }`}
              >
                <Avatar>
                  <AvatarFallback>{initials(c.firstName, c.lastName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {c.email} · {c.nationality}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-xs font-medium text-primary">
                    {t("client.selected")}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {selected && (
        <p className="text-sm text-muted-foreground">
          {t("client.selected")}: {selected.firstName} {selected.lastName}
        </p>
      )}
    </div>
  )
}
