import { FadeIn } from "../components/fade-in"

export function AboutUs() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 lg:px-6 lg:pb-24">
      <FadeIn>
        <div className="rounded-2xl border bg-card p-6 ring-1 ring-foreground/10 lg:p-10">
          <p className="font-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Хто ми
          </p>
          <p className="text-base leading-relaxed text-foreground lg:text-lg">
            <strong className="font-semibold">Webspirio</strong> — агенція цифрових рішень для
            бізнесу. Спеціалізуємося на B2B-CRM-системах та інструментах автоматизації для малого
            і середнього бізнесу, з повним циклом «від макета до продакшну». Усі наші проєкти
            мають живі продакшн-URL — ви вже бачили один із них (це робоче демо AnyTour CRM).
            Працюємо з використанням AI, що дозволяє пропонувати агенційну якість за фрилансерські
            ціни.
          </p>
        </div>
      </FadeIn>
    </section>
  )
}
