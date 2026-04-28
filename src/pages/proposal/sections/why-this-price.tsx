import { cn } from "@/lib/utils"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const reasons = [
  {
    title: "Демо вже готове",
    text: "Фронтенд (інтерфейс, дві мови, темна тема, всі екрани) вже зібраний і коштував окремо. На Етапі 1 ми тільки підмикаємо «двигун» (бекенд) до готового «кузова». В агенції спочатку малювали б макети, узгоджували, переробляли — це 60% бюджету.",
  },
  {
    title: "AI-augmented розробка",
    text: "Ми використовуємо Claude Code (Anthropic) для написання шаблонного коду — таблиці, форми, CRUD, переклади. Те, що раніше займало 8 годин, тепер 1 година ручної роботи + 7 годин валідації. Ми перекладаємо цю економію у вашу ціну.",
  },
  {
    title: "Без шарів менеджерів",
    text: "У великій агенції ваш бюджет ділиться між проектним менеджером, тімлідом, дизайнером, бекенд- і фронтенд-розробниками, тестувальником. Тут ви платите безпосередньо тим, хто пише код.",
  },
]

const valueBlocks = [
  {
    headline: "Уникаємо €2,500–4,500 збитків від подвійних продажів на рік.",
    text: "При завантаженні автобуса 90–95% (як 30.05) у Excel немає буфера: будь-який збій синхронізації між менеджерами — і одне місце продано двічі. На двох напрямках (Італія + Іспанія) ризик подвоюється — окремі файли, спільна команда. Кожен такий випадок коштує: компенсація клієнту + переселення в інший рейс + репутаційний удар. CRM не дозволяє цього технічно: щойно місце «sold», воно зникає з вибору в усіх інших менеджерів реалтайм, незалежно від напрямку.",
  },
  {
    headline: "~300 годин звільненого часу за рік = ~€10,000/рік.",
    text: "Зараз оформити одне бронювання в Excel — це ~10 хвилин (а сімейне на 4 пасажирів — у 4 рази довше через ручне дублювання). У майстрі CRM одне бронювання — 2–3 хв, групове — 4–5 хв на всю сім'ю. На двох напрямках (Італія + Іспанія, ~1,200 бронювань/рік) лише оформлення звільняє ~140 годин. Плюс ~160 годин на лукапи, правки, статуси оплат і передачу між менеджерами — разом ≈ 300 годин/рік. У перерахунку на повну вартість часу менеджера в Німеччині (€22/год з соцвнесками) — це ~€10,000/рік.",
  },
  {
    headline: "Звірка з 1–2 днів зводиться до 5 хвилин.",
    text: "Зараз бухгалтер чи власник зводить аркуші вручну. Це 1–2 робочі дні на місяць (~12 год). У CRM «звіт до виплати цього місяця» формується одним кліком. −12 год/міс × 12 міс × €22 = ~€3,170/рік.",
  },
  {
    headline: "+10% утримання постійних клієнтів = +€1,500/рік.",
    text: "У ваших Excel-файлах той самий клієнт із 2025-го по Італії та 2026-го по Іспанії — це два різні рядки в двох різних файлах. У CRM ви бачите його повну історію по всіх напрямках. Повторний клієнт коштує в 5–7 разів менше за нового. Одне «врятоване» повернення = €30–80 чистого прибутку, а cross-sell між напрямками — окремий бонус.",
  },
  {
    headline: "Витримує 50+ менеджерів — запас на 5+ років зростання.",
    text: "Сьогодні Excel працює на 4 менеджери. На 8 — почне ламатися. На 15 — впаде. CRM спокійно тримає 50+ користувачів, додавання нового напрямку (Хорватія, Чорногорія) — це не «копіюємо ще один аркуш», а зміна довідника за 10 хвилин.",
  },
  {
    headline: "Партнерський режим: економія масштабується разом із вашою мережею.",
    text: "Якщо CRM використовуватимуть 3 партнери (зі своїми напрямками), кожен з них теж економить €15k+/рік. Ваша вартість обслуговування системи лишається €3,960/рік, а сумарна цінність системи в екосистемі сягає €65,000+/рік.",
  },
]

const roi = [
  { row: "Запобігання подвійним продажам (~5 інцидентів × €700, два напрямки)", val: "~€3,500" },
  { row: "Звільнений час менеджерів (~300 год/рік × €22/год, Італія + Іспанія)", val: "~€10,000" },
  { row: "Звільнений час на звірках (12 год/міс × 12 міс × €22/год)", val: "~€3,170" },
  { row: "Покращене утримання постійних клієнтів (cross-route)", val: "~€1,500" },
]

export function WhyThisPrice() {
  return (
    <section id="section-6" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader
          number="6"
          title="Чому це коштує саме стільки"
          subtitle="Реальна вартість роботи, з прикладами економії і періодом окупності."
        />
      </FadeIn>

      {/* 6.1 Three reasons */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mb-6 text-lg font-semibold tracking-tight">
          6.1. Чому €6,500 там, де агенція бере €50,000
        </h3>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {reasons.map((r, i) => (
          <FadeIn key={r.title} delay={i * 0.07}>
            <div className="flex h-full flex-col rounded-xl border bg-card p-5 ring-1 ring-foreground/10">
              <div className="font-heading mb-2 text-3xl font-light tabular-nums text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </div>
              <p className="font-heading text-base font-semibold tracking-tight">{r.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* 6.2 Value blocks */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-4 text-lg font-semibold tracking-tight">
          6.2. Що ви насправді купуєте за €6,500
        </h3>
        <p className="mb-6 text-sm text-muted-foreground lg:text-[0.95rem]">
          Подумаймо, скільки ця система <strong className="text-foreground">повертає за один сезон</strong>:
        </p>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-2">
        {valueBlocks.map((b, i) => (
          <FadeIn key={b.headline} delay={i * 0.05}>
            <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex items-start gap-3">
                <span className="font-heading flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-foreground">
                  {i + 1}
                </span>
                <p className="font-heading text-sm font-semibold leading-snug tracking-tight lg:text-[0.95rem]">
                  {b.headline}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{b.text}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* 6.3 ROI */}
      <FadeIn delay={0.05}>
        <h3 className="font-heading mt-14 mb-4 text-lg font-semibold tracking-tight">
          6.3. Окупність
        </h3>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-medium lg:px-6">Стаття економії / прибутку</th>
                <th className="px-4 py-2.5 text-right font-medium lg:px-6">На рік</th>
              </tr>
            </thead>
            <tbody>
              {roi.map((r, i) => (
                <tr
                  key={r.row}
                  className={cn("border-b", i % 2 === 1 ? "bg-muted/10" : "")}
                >
                  <td className="px-4 py-3 lg:px-6">{r.row}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums lg:px-6">
                    {r.val}
                  </td>
                </tr>
              ))}
              <tr className="border-b bg-foreground/5">
                <td className="px-4 py-3 font-semibold lg:px-6">
                  Економія / додатковий дохід на рік (один оператор)
                </td>
                <td className="font-heading px-4 py-3 text-right text-lg font-semibold tabular-nums lg:px-6">
                  ~€18,170
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 text-muted-foreground lg:px-6">
                  Витрати на CRM на рік 1
                </td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6">€9,710</td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 text-muted-foreground lg:px-6">
                  Витрати на CRM на рік 2+
                </td>
                <td className="px-4 py-3 text-right tabular-nums lg:px-6">€3,960</td>
              </tr>
              <tr className="bg-primary/10">
                <td className="px-4 py-4 font-semibold lg:px-6 lg:py-5">Окупність</td>
                <td className="font-heading px-4 py-4 text-right text-xl font-semibold tabular-nums lg:px-6 lg:py-5">
                  ~7 місяців
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="mt-6 rounded-xl border-l-4 border-l-primary bg-primary/5 p-5">
          <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
            <strong>З партнерами:</strong> якщо в році 2 на CRM сидять ви + 3 партнери, сукупна
            економія в екосистемі ~€72,000/рік, а ваші витрати лишаються €3,960/рік.{" "}
            <strong>ROI ~18× уже на другий рік.</strong>
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Це консервативна оцінка. На практиці клієнти, що переходять з Excel на спеціалізовану
          CRM, повідомляють про окупність за 4–6 місяців, бо знаходять ще й продажі, які раніше
          «провалювалися» через відсутність нагадувань.
        </p>
      </FadeIn>
    </section>
  )
}
