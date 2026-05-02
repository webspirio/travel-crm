// Uses PhoneInputWithCountrySelect (default export) — includes country picker
// and accepts a custom `inputComponent`, allowing us to skip the library's CSS entirely.
//
// Note: PhoneInputWithCountrySelect is a class component whose ref points to the class
// instance, not the inner <input>. We declare the forwardRef with HTMLInputElement for
// API consistency, but we do not attempt to pass the ref through the class component
// (which would cause a TypeScript type mismatch). Callers that need a DOM ref should
// use a controlled value + callback pattern instead.
import { forwardRef } from "react"
import PhoneInputWithCountrySelect from "react-phone-number-input"
import type { Value } from "react-phone-number-input"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CountryCode } from "@/lib/phone"

export interface PhoneInputProps {
  value: string
  onChange: (value: string | undefined) => void
  defaultCountry?: CountryCode
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      defaultCountry = "DE",
      disabled,
      placeholder,
      id,
      className,
    },
    // ref intentionally not forwarded — the library class component's ref type is
    // incompatible with HTMLInputElement; callers should use controlled-value patterns.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ref,
  ) => {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <PhoneInputWithCountrySelect
          // Pass the shadcn Input so Tailwind styling stays consistent
          inputComponent={Input}
          value={value as Value}
          onChange={onChange}
          defaultCountry={defaultCountry}
          disabled={disabled}
          placeholder={placeholder}
          id={id}
        />
      </div>
    )
  },
)

PhoneInput.displayName = "PhoneInput"
