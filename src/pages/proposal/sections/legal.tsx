import { CheckCircle2, FileText, Shield, ShieldCheck, Users } from "lucide-react"

import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

const acceptanceCriteria = [
  {
    title: "Дані імпортовано",
    text: "Ваші Excel-файли бронювань (Італія, Іспанія) разом із усіма аркушами і додатковими файлами завантажено в систему без помилок, з можливістю переімпорту.",
  },
  {
    title: "Конкурентний доступ працює",
    text: "Троє ваших менеджерів одночасно створюють і редагують бронювання без конфліктів і подвійних продажів.",
  },
  {
    title: "Експорти і email працюють",
    text: "На ваших реальних даних: посадковий PDF, договір PDF.",
  },
  {
    title: "Multi-tenant ізоляція протестована",
    text: "Дані тестового партнера-2 не видно з акаунту партнера-1, і навпаки.",
  },
  {
    title: "Підписаний Acceptance Protocol",
    text: "Короткий документ, що підтверджує виконання пунктів 1–4. Це триггер фінального 25% платежу.",
  },
]

export function Legal() {
  return (
    <section id="section-9" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader number="9" title="Юридичні умови і гарантія" />
      </FadeIn>

      <div className="space-y-6">
        {/* 9.1 Договір */}
        <FadeIn delay={0.05}>
          <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/10 lg:p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
                <FileText className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                9.1. Договір і платежі
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
              Договір укладається з Webspirio, платежі в EUR на IBAN. Можлива німецька форма
              «reverse-charge VAT» для B2B всередині ЄС — узгоджується з вашим бухгалтером.
            </p>
          </div>
        </FadeIn>

        {/* 9.2 GDPR */}
        <FadeIn delay={0.1}>
          <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/10 lg:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
                <Shield className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                9.2. Захист персональних даних (GDPR)
              </h3>
            </div>
            <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
              <li className="relative pl-4 [&>strong]:text-foreground">
                <span className="absolute left-0 top-[0.65em] size-1 rounded-full bg-muted-foreground/40" />
                <strong>Інфраструктура у ЄС:</strong> Supabase Pro розгорнуто в регіоні Франкфурт
                (eu-central-1). Дані ваших клієнтів не покидають Європейського Союзу.
              </li>
              <li className="relative pl-4 [&>strong]:text-foreground">
                <span className="absolute left-0 top-[0.65em] size-1 rounded-full bg-muted-foreground/40" />
                <strong>Логи без PII:</strong> Sentry і моніторинг збирають лише технічні дані
                помилок — без персональних даних клієнтів чи фінансових показників.
              </li>
              <li className="relative pl-4 [&>strong]:text-foreground">
                <span className="absolute left-0 top-[0.65em] size-1 rounded-full bg-muted-foreground/40" />
                <strong>Право на видалення:</strong> ваші дані ми видалимо протягом 7 робочих
                днів за письмовим запитом. Бекапи — протягом 30 днів (стандартний цикл ротації).
              </li>
            </ul>
          </div>
        </FadeIn>

        {/* 9.3 Acceptance criteria */}
        <FadeIn delay={0.15}>
          <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/10 lg:p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
                <CheckCircle2 className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                9.3. Критерії приймання Етапу 1
              </h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground lg:text-[0.95rem]">
              Етап 1 вважається виконаним, коли:
            </p>
            <ol className="space-y-3">
              {acceptanceCriteria.map((c, i) => (
                <li key={c.title} className="flex gap-3">
                  <span className="font-heading flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-heading text-sm font-semibold tracking-tight">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
                      {c.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </FadeIn>

        {/* 9.4 Конфлікт */}
        <FadeIn delay={0.2}>
          <div className="rounded-xl border bg-card p-5 ring-1 ring-foreground/10 lg:p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
                <Users className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                9.4. Конфлікт інтересів
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground lg:text-[0.95rem]">
              Під час дії контракту та здачі Етапу 1 ми не беремося за розробку ідентичного
              продукту (CRM для автобусних турів) для прямих конкурентів AnyTour. Загальні
              CRM-системи для інших ніш чи інших напрямків — не вважаються конфліктом.
            </p>
          </div>
        </FadeIn>

        {/* 9.5 Гарантія */}
        <FadeIn delay={0.25}>
          <div className="overflow-hidden rounded-xl border-2 border-primary/40 bg-primary/5 p-5 ring-1 ring-primary/20 lg:p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/30">
                <ShieldCheck className="size-4" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight">
                9.5. Гарантія повернення 50%
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground lg:text-[0.95rem]">
              Якщо протягом 30 днів після запуску критерії приймання 1–4 з §9.3{" "}
              <strong>не виконуються</strong> попри наші розумні спроби їх виправити, ми
              повертаємо <strong>половину сплачених коштів</strong> — без судових процесів, через
              простий протокол приймання-передачі. Гарантія прив'язана до{" "}
              <em>об'єктивних критеріїв</em>, а не до суб'єктивної оцінки. Це наш спосіб взяти на
              себе частину ризику нового продукту.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
