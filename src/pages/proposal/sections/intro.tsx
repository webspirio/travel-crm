import { FadeIn } from "../components/fade-in"
import { SectionHeader } from "../components/section-header"

export function Intro() {
  return (
    <section id="section-1" className="mx-auto max-w-4xl px-4 py-16 lg:px-6 lg:py-24">
      <FadeIn>
        <SectionHeader number="1" title="Коротко в одному абзаці" />
      </FadeIn>
      <FadeIn delay={0.05}>
        <p className="text-base leading-relaxed text-foreground lg:text-lg lg:leading-[1.7]">
          Ви вже бачили демо: дашборд, інтерактивна розсадка автобуса, готелі, клієнти, менеджери,
          фінанси, календар, майстер бронювання, дві мови. Ця пропозиція — про наступний крок:{" "}
          <strong className="font-semibold">перетворити демо на робочу систему</strong>, у яку
          завтра сядуть ваші менеджери (і менеджери ваших партнерів) і яка повністю замінить ваші
          Excel-файли бронювань — як по Італії, так і по Іспанії, з можливістю додати нові
          напрямки. Після цього етапу ви вимикаєте Excel.
        </p>
      </FadeIn>
    </section>
  )
}
