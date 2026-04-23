import { useTranslation } from "react-i18next"
import { Link, useMatches } from "react-router"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface RouteHandle {
  titleKey?: string
}

export function SiteHeader() {
  const { t } = useTranslation()
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
    </header>
  )
}
