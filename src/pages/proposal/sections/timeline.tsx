import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const weeks = [
  {
    n: 1,
    text: "Бекенд, multi-tenant схема з першого дня, авторизація, ролі, Row-Level Security",
  },
  { n: 2, text: "Усі екрани переходять з тестових даних на реальну базу з контекстом партнера" },
  { n: 3, text: "Маршрути, алотменти, комісії, ціноутворення, hardening майстра бронювання" },
  {
    n: 4,
    text: "Імпорт вашого Excel, експорти, PDF-генерація, email-нагадування, файли, аудит-лог",
  },
  {
    n: 5,
    text: "Тестування ізоляції даних між партнерами, продакшн-деплой, навчання менеджерів, фікси",
  },
]

export function Timeline() {
  return (
    <section id="section-4" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="4"
          title="Терміни"
          subtitle="~5 тижнів від підписання до запуску в продакшн. Перші робочі результати на ваших даних — уже наприкінці тижня 2."
        />
      </FadeIn>

      <div className="relative">
        {/* connecting line */}
        <div
          aria-hidden
          className="absolute left-[1.55rem] top-2 bottom-2 w-px bg-border lg:left-7"
        />

        <ul className="space-y-3">
          {weeks.map((w, i) => (
            <FadeIn key={w.n} delay={i * 0.06}>
              <li className="relative flex items-start gap-4 lg:gap-6">
                <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 bg-background lg:size-14">
                  <div className="text-center">
                    <p className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                      тижд.
                    </p>
                    <p className="font-heading -mt-0.5 text-base font-semibold tabular-nums lg:text-lg">
                      {w.n}
                    </p>
                  </div>
                </div>
                <div className="flex-1 rounded-xl border bg-card px-4 py-3.5 ring-1 ring-foreground/5 lg:px-5 lg:py-4">
                  <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
                    {w.text}
                  </p>
                </div>
              </li>
            </FadeIn>
          ))}
        </ul>
      </div>

      <FadeIn delay={0.3}>
        <p className="mt-8 rounded-lg border bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
          Кожен тиждень — демо нового функціоналу на робочому URL, без сюрпризів наприкінці.
        </p>
      </FadeIn>
    </section>
  )
}
