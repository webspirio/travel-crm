// src/pages/login.tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import { LanguageSwitcher } from "@/components/layout/language-switcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validateRedirect } from "@/lib/validate-redirect"
import { NoTenantError, useAuthStore } from "@/stores/auth-store"

// Supabase returns this exact string in AuthApiError.message for
// wrong-password / unknown-user failures. Coupled to supabase-js
// implementation but stable across recent releases.
const SUPABASE_INVALID_CREDENTIALS_MSG = "Invalid login credentials"

// Schema is built inside the component so zod error keys can resolve
// against the current i18n language. We pass the t() function in.
function makeSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email({ message: t("errors.email_invalid") }),
    password: z.string().min(1, { message: t("errors.password_required") }),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

export default function LoginPage() {
  const { t, i18n } = useTranslation("auth")
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: { email: "", password: "" },
  })

  // Re-run validation when the user switches language so any displayed
  // field errors update to the new locale's strings. Without this, an
  // already-rendered error from the previous language stays stale until
  // the next validation trigger.
  useEffect(() => {
    void form.trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.resolvedLanguage])

  async function onSubmit(values: FormValues) {
    setServerError(null)
    const { error } = await signIn(values.email, values.password)

    if (!error) {
      const target = validateRedirect(params.get("redirect")) ?? "/"
      navigate(target, { replace: true })
      return
    }

    // Map the error to a user-facing message. NoTenantError is our typed
    // signal that auth succeeded but membership is inactive/missing.
    if (error instanceof NoTenantError) {
      setServerError(t("errors.no_workspace"))
    } else if (error.message === SUPABASE_INVALID_CREDENTIALS_MSG) {
      setServerError(t("errors.invalid_credentials"))
    } else {
      setServerError(t("errors.unknown"))
    }
    // Clear the password field but keep the email so the user can fix
    // a typo without retyping their address.
    form.setValue("password", "")
  }

  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">{t("heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("email.label")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder={t("email.placeholder")}
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("password.label")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="absolute bottom-4 right-4 w-36">
        <LanguageSwitcher />
      </div>
    </div>
  )
}
