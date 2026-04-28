import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"

import { FadeIn } from "../components/fade-in"

export function Summary() {
  return (
    <section id="section-11" className="px-4 py-20 lg:px-6 lg:py-28">
      <FadeIn>
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border bg-card p-8 ring-1 ring-foreground/10 lg:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_50%,color-mix(in_oklch,var(--foreground)_8%,transparent),transparent_70%)]"
          />
          <p className="text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Підсумок
          </p>
          <blockquote className="mt-6">
            <p className="font-heading text-balance text-center text-xl font-medium leading-snug tracking-tight lg:text-3xl lg:leading-[1.3]">
              За{" "}
              <span className="rounded bg-foreground/10 px-2 py-0.5">
                €6,500 одноразово і €330/міс надалі
              </span>{" "}
              ви отримуєте систему, що замінить Excel для вас і ваших партнерів, з технічною
              ізоляцією даних.
            </p>
            <p className="mt-6 text-balance text-center text-base text-muted-foreground lg:text-lg">
              Економія масштабується пропорційно кількості залучених партнерів — починаючи з{" "}
              <strong className="text-foreground">~€14,000/рік</strong> для одного оператора, і
              зростаючи до <strong className="text-foreground">€40,000+/рік</strong> на трьох
              партнерах. Окупність — від 6 місяців.
            </p>
          </blockquote>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center print:hidden">
            <Button size="lg" render={<a href="#footer" />}>
              <Send className="size-4" />
              Зв'язатись у Telegram
            </Button>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
