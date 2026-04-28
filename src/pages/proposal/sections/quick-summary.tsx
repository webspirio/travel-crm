import { Calendar, Euro, Globe, Sparkles, TrendingUp } from "lucide-react"

import { FadeIn } from "../components/fade-in"

const items = [
  {
    icon: Sparkles,
    label: "Що",
    text: "Перетворюємо демо CRM на робочу систему, що замінить ваші Excel-файли бронювань (Італія, Іспанія, нові напрямки) для вас і ваших партнерів.",
  },
  {
    icon: Euro,
    label: "Скільки",
    text: "€6,500 одноразово (зі знижкою 20% до 31.05.2026), далі €330/міс хостинг + підтримка.",
  },
  {
    icon: Calendar,
    label: "Коли",
    text: "~5 тижнів від підписання. Перші результати вже через 2 тижні.",
  },
  {
    icon: TrendingUp,
    label: "Що повертає",
    text: "~€17,000/рік економії на одного оператора (Італія + Іспанія), до €68,000/рік на трьох партнерах. Окупність — ~7 місяців.",
  },
  {
    icon: Globe,
    label: "Аналог в агенції Мюнхена / Берліна",
    text: "€40,000–80,000.",
  },
]

export function QuickSummary() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <div className="rounded-2xl border bg-muted/30 p-6 ring-1 ring-foreground/5 lg:p-10">
          <h2 className="font-heading mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Коротко
          </h2>
          <ul className="space-y-5">
            {items.map((item, i) => (
              <FadeIn key={item.label} delay={i * 0.05}>
                <li className="flex gap-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-foreground/10">
                    <item.icon className="size-4 text-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-heading text-sm font-medium tracking-tight text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-base text-foreground">{item.text}</p>
                  </div>
                </li>
              </FadeIn>
            ))}
          </ul>
        </div>
      </FadeIn>
    </section>
  )
}
