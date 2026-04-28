import { Minus } from "lucide-react"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const items = [
  "Каси і трекінг готівки по точках оплати",
  "Виборчі мітки інклюзивності, групові посадки",
  "OCR паспорта (автозаповнення з фото)",
  "Боти Viber / Telegram",
  "Публічна сторінка туру для відправки в месенджер",
  "Особистий кабінет клієнта",
  "Мобільний режим водія",
  "Когортна аналітика, прогноз виручки, конверсія воронки",
  "Самореєстрація партнерів і онлайн-платежі через Stripe",
]

export function WhatNotIncluded() {
  return (
    <section id="section-3" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="3"
          title="Що не входить в Етап 1"
          subtitle="Винесено в Етап 2. Кожна з цих функцій додає тижні роботи; логічно зробити їх після того, як основа поживе на реальних бронюваннях 1–2 місяці."
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground ring-1 ring-foreground/5"
            >
              <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="mt-8 rounded-xl border-l-4 border-l-foreground/40 bg-muted/30 p-5 lg:p-6">
          <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
            <strong className="font-semibold">Етап 2</strong> — окремий контракт, коли визначимо
            пріоритети після рев'ю Етапу 1. Обсяг і вартість погоджуємо після вибору конкретних
            фіч. Якщо одна з цих функцій критична для вас уже на старті — скажіть, узгодимо
            включення в Етап 1 окремо.
          </p>
        </div>
      </FadeIn>
    </section>
  )
}
