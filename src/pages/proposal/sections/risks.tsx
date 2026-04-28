import { AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

type Risk = { title: string; text: ReactNode }

const risks: Risk[] = [
  {
    title: "Імпорт Excel",
    text: (
      <>
        Найризикованіший пункт. Якщо у вашому файлі знайдеться нестандартна структура на якомусь
        аркуші, це додасть 1–2 дні. Ми хочемо побачити{" "}
        <strong>актуальну версію всіх файлів перед підписанням</strong>, щоб гарантувати фіксовану
        ціну.
      </>
    ),
  },
  {
    title: "Навчання команди",
    text: (
      <>
        CRM не звужує можливості, але звужує <strong>способи</strong> робити — менеджери звикли
        до Excel-свободи, перші 2 тижні буде опір. Передбачено в підтримці.
      </>
    ),
  },
  {
    title: "Multi-tenant безпека",
    text: (
      <>
        Ізоляція даних між партнерами — критична. Ми проводимо окреме тестування у фінальному
        тижні, але рекомендуємо також зробити security-аудит від третьої сторони перед
        підключенням першого партнера (€500–1,000 окремою угодою з аудитором).
      </>
    ),
  },
  {
    title: "Етап 2",
    text: (
      <>
        Якщо в процесі ви вирішите, що потрібен ще, наприклад, режим для водія щоб підтвердити
        посадку — він не входить у €6,500. Ми скажемо про це чесно і запропонуємо або винести в
        Етап 2, або підрізати інше з Етапу 1.
      </>
    ),
  },
]

export function Risks() {
  return (
    <section id="section-8" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="8"
          title="Чесно про ризики"
          subtitle="Щоб у вас не виникло відчуття «занадто гладко» — ось чесний перелік."
        />
      </FadeIn>

      <ul className="space-y-3">
        {risks.map((r, i) => (
          <FadeIn key={r.title} delay={i * 0.05}>
            <li className="flex items-start gap-4 rounded-xl border bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <AlertTriangle className="size-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="font-heading text-sm font-semibold tracking-tight lg:text-base">
                  {r.title}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
                  {r.text}
                </p>
              </div>
            </li>
          </FadeIn>
        ))}
      </ul>
    </section>
  )
}
