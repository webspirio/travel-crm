import { useState } from "react"
import { Check, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const market = [
  { who: "IT-агенція в Мюнхені / Берліні", price: "€40,000 – €80,000", highlight: false },
  { who: "Українська або польська студія середнього рівня", price: "€18,000 – €28,000" },
  { who: "Сильний фрилансер у класичному режимі", price: "€12,000 – €18,000" },
  { who: "Наша пропозиція", price: "€6,500", highlight: true },
]

const hosting = [
  { service: "Supabase Pro", desc: "БД, авторизація, файли, бекапи", price: "€25" },
  { service: "Resend", desc: "Email-розсилка до 3,000 листів/міс", price: "€18" },
  { service: "Домен + Cloudflare", desc: "URL, SSL, CDN, базовий захист", price: "€1" },
  { service: "Моніторинг + offsite-бекапи", desc: "Sentry, копії бази", price: "€5" },
  { service: "Адміністрування", desc: "Адміністрування хостингу", price: "€31" },
]

type TierKey = "none" | "bronze" | "silver" | "gold"

const tiers: {
  key: TierKey
  name: string
  monthly: number
  priceLabel: string
  text: string
  recommended: boolean
}[] = [
  {
    key: "none",
    name: "Без підтримки",
    monthly: 0,
    priceLabel: "€0",
    text: "Тільки хостинг. Будь-які правки після запуску — за окремою погодинною ставкою (€60/год).",
    recommended: false,
  },
  {
    key: "bronze",
    name: "Bronze",
    monthly: 100,
    priceLabel: "€100",
    text: "Моніторинг, виправлення критичних багів, оновлення безпеки. 1 година роботи на міс.",
    recommended: false,
  },
  {
    key: "silver",
    name: "Silver",
    monthly: 250,
    priceLabel: "€250",
    text: "Все з Bronze + 5 годин на міс (дрібні правки, нові звіти, шаблони листів), щомісячний 30-хв дзвінок.",
    recommended: true,
  },
  {
    key: "gold",
    name: "Gold",
    monthly: 600,
    priceLabel: "€600",
    text: "Все з Silver + 15 годин на міс (можна виконати фічі з Етапу 2 в межах ретейнера), дзвінок раз на 2 тижні.",
    recommended: false,
  },
]

const HOSTING_MONTHLY = 80
const DEV_DISCOUNTED = 6500

function formatEuro(n: number) {
  return `€${n.toLocaleString("en-US")}`
}

function yearOneSupport(tier: TierKey, monthly: number) {
  if (tier === "none") return 0
  if (tier === "silver") return monthly * 9 // 3 місяці безкоштовно
  return monthly * 12
}

export function Investment() {
  const [selectedTier, setSelectedTier] = useState<TierKey>("silver")
  const tier = tiers.find((t) => t.key === selectedTier)!
  const supportYearOne = yearOneSupport(selectedTier, tier.monthly)
  const hostingYearOne = HOSTING_MONTHLY * 12
  const totalYearOne = DEV_DISCOUNTED + hostingYearOne + supportYearOne
  const ongoingMonthly = HOSTING_MONTHLY + tier.monthly
  const ongoingYear = ongoingMonthly * 12
  const supportLabel =
    selectedTier === "silver"
      ? "Підтримка Silver (3 міс безкоштовно + 9 міс × €250)"
      : selectedTier === "none"
        ? "Підтримка"
        : `Підтримка ${tier.name} (12 міс × ${tier.priceLabel})`

  return (
    <section id="section-5" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader number="5" title="Інвестиція" />
      </FadeIn>

      {/* 5.1 Comparison */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mb-4 text-lg font-semibold tracking-tight">
          5.1. Одноразова розробка (Етап 1)
        </h3>
        <p className="mb-6 text-sm text-muted-foreground lg:text-[0.95rem]">
          Перш ніж назвати ціну — ось скільки той самий обсяг коштує на ринку:
        </p>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-xl border ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <tbody>
              {market.map((row, i) => (
                <tr
                  key={row.who}
                  className={cn(
                    "border-b last:border-b-0",
                    row.highlight ? "bg-primary/5" : i % 2 === 1 ? "bg-muted/20" : ""
                  )}
                >
                  <td
                    className={cn(
                      "px-4 py-3 lg:px-6 lg:py-4",
                      row.highlight && "font-semibold"
                    )}
                  >
                    {row.who}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-right tabular-nums lg:px-6 lg:py-4",
                      row.highlight && "font-heading text-lg font-semibold"
                    )}
                  >
                    {row.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Чому ми можемо запропонувати €6,500 там, де агенція бере €50k — пояснюємо в §6.
        </p>
      </FadeIn>

      {/* Pricing breakdown */}
      <FadeIn delay={0.15}>
        <div className="mt-8 overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3 lg:px-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Розбивка ціни
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  Розробка production-MVP з multi-tenant (повний обсяг §2)
                </td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6 lg:py-4">€8,125</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  <span className="mr-1.5">🎁</span>
                  Знижка 20% — лише при підписанні до 31 травня 2026
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-muted-foreground lg:px-6 lg:py-4">
                  −€1,625
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className="px-4 py-4 font-semibold lg:px-6 lg:py-5">До оплати за Етап 1</td>
                <td className="font-heading px-4 py-4 text-right text-2xl font-semibold tabular-nums lg:px-6 lg:py-5 lg:text-3xl">
                  €6,500
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm">
          <p className="text-foreground">
            <Sparkles className="mr-1.5 inline size-4 text-foreground" />
            <strong>UA Well Community</strong> — знижка 20% — це наш спосіб зайти у партнерство
            «по-чесному».
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Графік оплати:</strong> 4 платежі по 25% (€1,625
          кожен) за milestone — старт, тиждень 3, тиждень 5, запуск.
        </p>
      </FadeIn>

      {/* 5.2 Hosting */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-4 text-lg font-semibold tracking-tight">
          5.2. Хостинг (щомісяця після запуску)
        </h3>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-xl border ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium lg:px-6">Сервіс</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell lg:px-6">Що дає</th>
                <th className="px-4 py-2.5 text-right font-medium lg:px-6">Ціна</th>
              </tr>
            </thead>
            <tbody>
              {hosting.map((row, i) => (
                <tr key={row.service} className={i % 2 === 1 ? "bg-muted/10" : ""}>
                  <td className="px-4 py-3 font-medium lg:px-6">{row.service}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell lg:px-6">
                    {row.desc}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums lg:px-6">{row.price}</td>
                </tr>
              ))}
              <tr className="border-t bg-primary/5">
                <td colSpan={2} className="px-4 py-4 font-semibold lg:px-6">
                  Усе разом
                </td>
                <td className="font-heading px-4 py-4 text-right text-lg font-semibold tabular-nums lg:px-6">
                  €80/міс
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Ви платите фіксовану суму — ми ведемо всі підрядні рахунки та моніторинг. Ваш фінвідділ
          бачить один рахунок на місяць або на рік.
        </p>
      </FadeIn>

      {/* 5.3 Support tiers */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-2 text-lg font-semibold tracking-tight">
          5.3. Підтримка (щомісяця, на вибір)
        </h3>
        <p className="mb-4 text-sm text-muted-foreground lg:text-[0.95rem]">
          Натисніть на варіант — підрахунок у §5.4 оновиться. За замовчуванням вибрано{" "}
          <strong className="text-foreground">Silver</strong>, але ви можете вибрати інший рівень
          або відмовитись від підтримки взагалі.
        </p>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t, i) => {
          const isSelected = t.key === selectedTier
          return (
            <FadeIn key={t.key} delay={i * 0.05}>
              <button
                type="button"
                onClick={() => setSelectedTier(t.key)}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex h-full w-full flex-col rounded-xl border bg-card p-6 text-left transition-all",
                  "hover:border-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary ring-2 ring-primary shadow-lg"
                    : t.recommended
                      ? "ring-1 ring-primary/30"
                      : "ring-1 ring-foreground/10"
                )}
              >
                {t.recommended && !isSelected && (
                  <Badge className="absolute -top-2.5 left-6">🟢 Рекомендовано</Badge>
                )}
                {isSelected && (
                  <Badge className="absolute -top-2.5 left-6">
                    <Check className="size-3" /> Вибрано
                  </Badge>
                )}
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.name}</p>
                <p className="font-heading mt-1 text-3xl font-semibold tabular-nums">
                  {t.priceLabel}
                  <span className="text-base font-normal text-muted-foreground">/міс</span>
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
              </button>
            </FadeIn>
          )
        })}
      </div>

      {selectedTier === "silver" && (
        <FadeIn delay={0.1}>
          <div className="mt-6 rounded-xl border-l-4 border-l-foreground/40 bg-muted/30 p-5">
            <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
              <strong className="font-semibold">Бонус при підписанні Етапу 1:</strong> перші{" "}
              <strong className="font-semibold">3 місяці Silver безкоштовно</strong>, далі
              €250/міс. Тобто перший рік ви платите за підтримку лише{" "}
              <strong>€2,250</strong> замість €3,000.
            </p>
          </div>
        </FadeIn>
      )}

      {/* 5.4 Year 1 totals */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-4 text-lg font-semibold tracking-tight">
          5.4. Сумарно за перший рік
        </h3>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-3 lg:px-6 lg:py-4">Розробка (зі знижкою)</td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6 lg:py-4">
                  {formatEuro(DEV_DISCOUNTED)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 lg:px-6 lg:py-4">Хостинг (12 міс × €80)</td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6 lg:py-4">
                  {formatEuro(hostingYearOne)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 lg:px-6 lg:py-4">
                  {selectedTier !== "none" && (
                    <Check className="mr-1 inline size-3.5 text-foreground" />
                  )}
                  {supportLabel}
                </td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6 lg:py-4">
                  {selectedTier === "none" ? "—" : formatEuro(supportYearOne)}
                </td>
              </tr>
              <tr className="bg-primary/5">
                <td className="px-4 py-4 font-semibold lg:px-6 lg:py-5">Усього за рік 1</td>
                <td className="font-heading px-4 py-4 text-right text-2xl font-semibold tabular-nums lg:px-6 lg:py-5">
                  {formatEuro(totalYearOne)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          З другого року:{" "}
          <strong className="text-foreground">{formatEuro(ongoingYear)}/рік</strong>{" "}
          {selectedTier === "none"
            ? "(тільки хостинг)"
            : `(хостинг €80/міс + підтримка ${tier.priceLabel}/міс)`}
          .
        </p>
      </FadeIn>
    </section>
  )
}
