import { CalendarCheck, Phone, Send } from "lucide-react"

export function Footer() {
  return (
    <footer id="footer" className="border-t bg-muted/20">
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6 lg:py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Контакт для запитань і підписання
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <a
              href="https://calendar.app.google/Faf8t6fmr8canNLf6"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-foreground px-4 py-2.5 text-sm font-medium text-background ring-1 ring-foreground/20 transition-all hover:bg-foreground/90"
            >
              <CalendarCheck className="size-4" />
              Записатись на 30-хв зустріч
            </a>
            <a
              href="https://t.me/swefd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium ring-1 ring-foreground/10 transition-all hover:bg-muted/50"
            >
              <Send className="size-4" />
              Telegram: @swefd
            </a>
            <a
              href="tel:+4915124130699"
              className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium ring-1 ring-foreground/10 transition-all hover:bg-muted/50"
            >
              <Phone className="size-4" />
              +49 151 24130699
            </a>
          </div>
          <p className="mt-4 max-w-xl text-balance text-xs italic text-muted-foreground">
            Знижка 20% (€1,625) діє до 14 травня 2026. Після цієї дати вартість Етапу 1 — €8,125.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            © 2026 Webspirio · Агенція цифрових рішень для бізнесу
          </p>
        </div>
      </div>
    </footer>
  )
}
