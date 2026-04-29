import { ArrowRight, CalendarCheck, Send } from "lucide-react"

import { Button } from "@/components/ui/button"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const steps = [
  { text: "Ви читаєте цю пропозицію і виписуєте всі питання." },
  {
    text: "Зустріч 30 хв — пройдемося пунктами, що неясно, що додати/прибрати, узгоджуємо точну дату старту.",
  },
  { text: "Підписуємо договір з фіксованою сумою €6,500 і графіком 4 платежів." },
  { text: "Старт. Через тиждень ви бачите першу робочу версію з вашими реальними даними." },
  {
    text: "Через ~5 тижнів — повноцінний запуск, ваші менеджери закривають Excel і відкривають CRM.",
  },
]

const requirements = [
  {
    when: "До тижня 1",
    what: "Актуальні Excel-файли бронювань по всіх напрямках (Італія, Іспанія) і супутні файли (умови, маршрут, готелі) — для імпорту.",
  },
  {
    when: "До тижня 2",
    what: "Список менеджерів з email-адресами для створення акаунтів + ваш домен для відправки листів (наприклад, info@anytour.de).",
  },
  {
    when: "Щотижня",
    what: "~30 хв на демо нової версії — дзвінок або відеозапис із вашими коментарями.",
  },
  {
    when: "Постійно",
    what: "Один decision-maker з вашого боку — людина, яка може швидко сказати «так/ні» на дрібні рішення в процесі.",
  },
  {
    when: "Канал",
    what: "Telegram-чат для оперативних питань, файлів і офіційних узгоджень. Дзвінки — за потреби.",
  },
]

export function NextSteps() {
  return (
    <section id="section-7" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader number="7" title="Що далі і що потрібно від вас" />
      </FadeIn>

      {/* 7.1 Steps */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mb-6 text-lg font-semibold tracking-tight">
          7.1. Як виглядає наш спільний шлях
        </h3>
      </FadeIn>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <FadeIn key={i} delay={i * 0.06}>
            <li className="flex items-start gap-4 rounded-xl border bg-card px-5 py-4 ring-1 ring-foreground/10">
              <span className="font-heading flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
                {s.text}
              </p>
            </li>
          </FadeIn>
        ))}
      </ol>

      {/* 7.2 Client requirements */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-6 text-lg font-semibold tracking-tight">
          7.2. Що нам потрібно від вас, щоб тримати графік 5 тижнів
        </h3>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
          <ul className="divide-y">
            {requirements.map((r) => (
              <li key={r.when} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
                <p className="shrink-0 sm:w-32 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {r.when}
                </p>
                <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
                  {r.what}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </FadeIn>

      {/* CTA box */}
      <FadeIn delay={0.2}>
        <div className="mt-10 overflow-hidden rounded-2xl border bg-foreground text-background ring-1 ring-foreground/20 print:hidden">
          <div className="p-6 lg:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-background/60">
              Що потрібно від вас зараз
            </p>
            <p className="font-heading mt-3 text-xl font-semibold leading-snug tracking-tight lg:text-2xl">
              Дайте відповідь до 14 травня 2026 — обираємо дату 30-хв зустрічі, і за тиждень після
              підписання починаємо.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-background/70 lg:text-[0.95rem]">
              Кожен день затримки — це місце в графіку, яке заблокує наступний клієнт. Після 14
              травня знижку 20% (€1,625) знято, і ціна Етапу 1 — €8,125.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="secondary"
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
                variant="ghost"
                className="text-background hover:bg-background/10 hover:text-background"
                onClick={() =>
                  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Send className="size-4" />
                Telegram
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-background hover:bg-background/10 hover:text-background"
                onClick={() =>
                  document.getElementById("section-1")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Перечитати
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  )
}
