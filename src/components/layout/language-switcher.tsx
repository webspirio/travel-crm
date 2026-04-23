import { useTranslation } from "react-i18next"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n/config"

const FLAGS: Record<SupportedLanguage, string> = {
  uk: "🇺🇦",
  de: "🇩🇪",
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? "uk") as SupportedLanguage

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v) i18n.changeLanguage(v as SupportedLanguage)
      }}
    >
      <SelectTrigger className="w-full" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}>
            <span className="mr-2">{FLAGS[lng]}</span>
            {t(`language.${lng}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
