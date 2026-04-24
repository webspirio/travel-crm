import { useTranslation } from "react-i18next"
import { Link, useMatches } from "react-router"
import { Fragment } from "react"
import { Search } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePaletteStore } from "@/stores/palette-store"

interface RouteHandle {
  titleKey?: string
}

export function SiteHeader() {
  const { t } = useTranslation()
  const setPaletteOpen = usePaletteStore((s) => s.setOpen)
  const matches = useMatches() as Array<{
    pathname: string
    handle?: RouteHandle
  }>
  const crumbs = matches.filter((m) => m.handle?.titleKey)

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((m, i) => {
            const isLast = i === crumbs.length - 1
            const label = t(m.handle!.titleKey as never)
            return (
              <Fragment key={m.pathname}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link to={m.pathname}>{label}</Link>} />
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-8 gap-2 text-muted-foreground"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">{t("palette.trigger")}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>
    </header>
  )
}
