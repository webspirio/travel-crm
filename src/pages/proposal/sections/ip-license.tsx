import { Building2, Code2, Handshake } from "lucide-react"
import type { ReactNode } from "react"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

type Block = {
  icon: typeof Code2
  label: string
  title: string
  bullets: ReactNode[]
  accent: "primary" | "muted" | "neutral"
}

const blocks: Block[] = [
  {
    icon: Code2,
    label: "Що отримуєте ви",
    title: "AnyTour",
    accent: "primary",
    bullets: [
      <>
        <strong>Повний доступ до вихідного коду</strong> з першого дня. Git-репозиторій, всі
        коміти, вся історія розробки.
      </>,
      <>
        <strong>Ліцензія на використання, модифікацію і розповсюдження</strong> вашого
        екземпляра системи. Жодних licensing-залежностей, жодних блокувань.
      </>,
      <>
        <strong>Ліцензія на використання нашої внутрішньої бібліотеки</strong> (Webspirio
        Internal Toolkit), що вбудована у проєкт.
      </>,
      <>
        <strong>Ваші бізнес-дані</strong> (клієнти, бронювання, контракти, готелі, фінансові
        показники) — ваші 100%, повністю і виключно.
      </>,
    ],
  },
  {
    icon: Building2,
    label: "Що залишається у нас",
    title: "Webspirio",
    accent: "muted",
    bullets: [
      <>
        <strong>Право повторного використання коду</strong> цього проєкту в наших майбутніх
        роботах для інших клієнтів. Архітектурні рішення, патерни, інтеграції — це наша
        інженерна база.
      </>,
      <>
        <strong>Право посилатися на ваш проєкт як кейс</strong> у нашому портфоліо (із вашою
        згодою на конкретні згадки і скріншоти).
      </>,
    ],
  },
  {
    icon: Handshake,
    label: "Чому це чесний обмін",
    title: "Win-win",
    accent: "neutral",
    bullets: [
      <>
        За класичною моделлю агенція тримає код «під ключ» і виставляє вам ліцензію на роки —{" "}
        <strong>€40k+ і не можете піти</strong>. Тут навпаки: код ваш, ціна €6,500.
      </>,
      <>
        Ми компенсуємо нижчу ціну тим, що інженерна база лишається з нами і працює на наступних
        клієнтів. Ви не платите за «ексклюзивність» того, що вам все одно не потрібне.
      </>,
      <>
        Якщо потрібна <strong>ексклюзивна власність на код</strong> — це окрема комерційна
        модель, ціна стартує від <strong>€18,000</strong>. Скажіть, обговоримо.
      </>,
    ],
  },
]

export function IpLicense() {
  return (
    <section id="section-10" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="10"
          title="Власність на код і ліцензії"
          subtitle="Прямо й без юридичних формул — це win-win-модель, яка пояснює, чому ціна €6,500, а не €40,000."
        />
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        {blocks.map((b, i) => (
          <FadeIn key={b.label} delay={i * 0.07}>
            <div
              className={
                b.accent === "primary"
                  ? "flex h-full flex-col rounded-xl border-2 border-primary/30 bg-primary/5 p-5 ring-1 ring-primary/20 lg:p-6"
                  : b.accent === "muted"
                    ? "flex h-full flex-col rounded-xl border bg-muted/30 p-5 ring-1 ring-foreground/10 lg:p-6"
                    : "flex h-full flex-col rounded-xl border bg-card p-5 ring-1 ring-foreground/10 lg:p-6"
              }
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-background/60 ring-1 ring-foreground/10">
                  <b.icon className="size-4" />
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {b.label}
                  </p>
                  <p className="font-heading text-sm font-semibold tracking-tight">{b.title}</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                {b.bullets.map((bullet, j) => (
                  <li key={j} className="relative pl-4 [&>strong]:text-foreground">
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.65em] size-1 rounded-full bg-muted-foreground/40"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
