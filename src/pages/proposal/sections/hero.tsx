import { motion } from "motion/react"
import { ArrowDown, CalendarCheck, Send } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center lg:px-6 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          <Badge variant="outline" className="px-3 py-1 text-[0.7rem] tracking-wider uppercase">
            Webspirio · Komercійна пропозиція
          </Badge>
          <p className="text-sm text-muted-foreground">квітень 2026 · для власника AnyTour</p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="font-heading mt-6 text-balance text-4xl font-semibold tracking-tight lg:text-6xl"
        >
          AnyTour CRM —<br className="hidden sm:inline" />{" "}
          <span className="text-muted-foreground">production-MVP за 5 тижнів</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground lg:text-xl"
        >
          Перетворюємо демо на робочу систему, що замінить ваші Excel-файли бронювань (Італія,
          Іспанія та інші напрямки) для вас і ваших партнерів.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <KpiCard label="Фіксована ціна" value="€6,500" hint="зі знижкою 20%" />
          <KpiCard label="Терміни" value="~5 тижнів" hint="перші результати на тижні 2" />
          <KpiCard label="Економія" value="~€18k/рік" hint="окупність ~7 місяців" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row print:hidden"
        >
          <Button
            size="lg"
            render={
              <a
                href="https://calendar.app.google/Faf8t6fmr8canNLf6"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <CalendarCheck className="size-4" />
            Записатись на 30-хв зустріч
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              document.getElementById("section-7")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Send className="size-4" />
            Зв'язатись у Telegram
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() =>
              document.getElementById("section-1")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Прокрутити деталі
            <ArrowDown className="size-4" />
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          Аналог в IT-агенції Мюнхена / Берліна — €40,000–80,000
        </motion.p>
      </div>
    </section>
  )
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card/60 px-4 py-5 ring-1 ring-foreground/5 backdrop-blur">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-heading mt-1.5 text-2xl font-semibold tracking-tight lg:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
