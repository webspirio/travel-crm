import {
  Database,
  FileText,
  type LucideIcon,
  Server,
  ShoppingCart,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

type Block = {
  id: string
  icon: LucideIcon
  title: string
  bullets: ReactNode[]
}

const blocks: Block[] = [
  {
    id: "2.1",
    icon: Database,
    title: "Бекенд і дані",
    bullets: [
      <>
        <strong>Реальна база даних</strong> (PostgreSQL через Supabase) замість тестових даних.
      </>,
      <>
        <strong>Авторизація і ролі:</strong> власник, менеджер, агент. Кожен бачить рівно те, що
        йому дозволено.
      </>,
      <>
        <strong>Multi-tenant архітектура:</strong> одна спільна база, але дані кожного партнера
        ізольовані технічно. Жоден партнер не бачить даних іншого.
      </>,
      <>
        <strong>Імпорт історії з Excel.</strong> Парсери для ваших файлів бронювань по всіх
        напрямках (Італія, Іспанія, додаткові маршрути) — кожен зі своєю структурою аркушів. У
        перший день у CRM уже є ваша реальна база. <em>Ключова функція переходу.</em>
      </>,
      <>
        <strong>Реалтайм:</strong> двоє менеджерів одночасно дивляться на ту ж саму карту автобуса
        і не можуть продати одне місце двічі.
      </>,
    ],
  },
  {
    id: "2.2",
    icon: ShoppingCart,
    title: "Реальний процес бронювання",
    bullets: [
      <>
        <strong>Довідник напрямків</strong> (Італія, Іспанія, нові країни — додавання за ~10 хв
        конфігурації) з повним маршрутом і пунктами посадки (Прага → Нюрнберг → Мюнхен → Аугсбург
        тощо), GPS-координатами, часом, адресою.
      </>,
      <>
        <strong>Алотменти готелів по датах:</strong> матриця «готель × тип номера × виїзд»,
        авторезерв при бронюванні, алерт «лишилось 1 DBL на 17.07».
      </>,
      <>
        <strong>Ціноутворення:</strong> доросла / дитяча ціна, доплата за перші 3 ряди (+30 EUR),
        тариф «лише трансфер без готелю».
      </>,
      <>
        <strong>Групові бронювання:</strong> один договір — кілька пасажирів (сім'я, друзі,
        організована група). Спільна заявка, спільна оплата, окремі місця в автобусі і паспортні
        дані для кожного. Як у ваших файлах — родина Meshkelo (4 особи) на одному номері заявки.
      </>,
      <>
        <strong>Номери заявок і договорів</strong> генеруються автоматично за вашим шаблоном
        (RE26001, 26002 …).
      </>,
      <>
        <strong>Комісії менеджерів:</strong> гнучкі правила, автозвіт «до виплати цього місяця».
      </>,
    ],
  },
  {
    id: "2.3",
    icon: FileText,
    title: "Документи і комунікація",
    bullets: [
      <>
        <strong>Excel-експорт:</strong> список пасажирів по туру, алотменти готелів, виручка по
        місяцях.
      </>,
      <>
        <strong>PDF-генерація:</strong> посадковий аркуш для водія, договір з клієнтом.
      </>,
      <>
        <strong>Email-нагадування:</strong> підтвердження бронювання, нагадування про доплату,
        нагадування за 7 днів до виїзду. Шаблони українською і німецькою.
      </>,
      <>
        <strong>Файли:</strong> прикріплення сканів паспортів і документів до клієнта чи
        бронювання.
      </>,
      <>
        <strong>Аудит-лог:</strong> хто що змінив і коли. Видно тільки власнику.
      </>,
    ],
  },
  {
    id: "2.4",
    icon: Users,
    title: "Партнерський режим (multi-tenant)",
    bullets: [
      <>Один екземпляр CRM обслуговує вас + ваших партнерів.</>,
      <>
        Кожен партнер бачить лише свої тури, своїх клієнтів, своїх менеджерів, свою фінансову
        статистику.
      </>,
      <>
        Дані ізольовані технічно через Row-Level Security — той самий рівень захисту, що в
        банківських системах.
      </>,
      <>
        Підключення нового партнера: ~30 хвилин роботи через адмін-панель + перенесення даних з
        Excel за окрему угоду (€300–500 за партнера).
      </>,
      <>
        <strong>Гарантія обсягу: до 4 партнерів</strong> у межах цього контракту (включно з вашою
        компанією). Більше — обговорюємо як окремий проєкт або Етап 2.
      </>,
    ],
  },
  {
    id: "2.5",
    icon: Server,
    title: "Продакшн-інфраструктура",
    bullets: [
      <>
        Власний домен, HTTPS, щоденні бекапи бази, моніторинг помилок (Sentry), верифікований
        відправник пошти.
      </>,
      <>
        <strong>Адаптивний інтерфейс:</strong> основні екрани повноцінно працюють на телефоні.
        Складні модулі (розсадка автобуса, майстер бронювання) оптимізовано для планшета і
        десктопа.
      </>,
      <>Готовність до 50+ менеджерів і кількох тисяч бронювань на сезон без перебудови.</>,
    ],
  },
]

export function WhatIncluded() {
  return (
    <section id="section-2" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="2"
          title="Що входить в production-MVP"
          subtitle="Усе, що менеджер чи власник торкається щодня в реальній роботі, входить у Етап 1."
        />
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((b, i) => (
          <FadeIn key={b.id} delay={i * 0.05}>
            <div className="flex h-full flex-col rounded-xl border bg-card p-6 ring-1 ring-foreground/10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
                  <b.icon className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
                    §{b.id}
                  </p>
                  <h3 className="font-heading text-lg font-semibold tracking-tight">{b.title}</h3>
                </div>
              </div>
              <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
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
