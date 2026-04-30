import { LogOut } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Database } from "@/types/database"
import { useAuthStore } from "@/stores/auth-store"

type Role = Database["public"]["Enums"]["tenant_role"]

function initialsFromEmail(email: string | undefined): string {
  if (!email) return "?"
  const local = email.split("@")[0] ?? ""
  return local.slice(0, 2).toUpperCase() || "?"
}

export function UserMenu() {
  const { t } = useTranslation("auth")
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)

  // Hide entirely if there's no user. Should never happen inside a
  // RequireAuth-wrapped tree, but defensive.
  if (!user) return null

  const initials = initialsFromEmail(user.email)
  const roleLabel = role ? t(`menu.role.${role satisfies Role}`) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label={t("menu.trigger")}
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{user.email}</span>
          {roleLabel && (
            <span className="text-xs text-muted-foreground">{roleLabel}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOut className="mr-2 size-4" aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
