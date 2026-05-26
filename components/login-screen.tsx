"use client"

import { useState } from "react"
import { Logo } from "@/components/logo"
import { translate, type Language } from "@/lib/i18n"
import type { User } from "@/lib/types"

interface LoginScreenProps {
  language: Language
  onLanguageChange: (language: Language) => void
  onLogin: (user: User) => Promise<void>
}

export function LoginScreen({ language, onLanguageChange, onLogin }: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    const email = readString(formData, "email")
    const password = readString(formData, "password")

    setIsSubmitting(true)
    setError(null)

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    })
    const result = (await response.json()) as { error?: string; user?: User }

    if (response.ok && result.user) {
      setError(null)
      await onLogin(result.user)
      setIsSubmitting(false)
      return
    }

    setError(result.error ?? "Unable to sign in.")
    setIsSubmitting(false)
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-6">
      <section className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:max-w-md sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Logo />
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </div>

        <div>
          <div>
            <h1 className="text-xl font-semibold">{translate(language, "signIn")}</h1>
          </div>
          <form action={handleSubmit} className="mt-4 space-y-3">
            <label className="block space-y-1 text-sm font-medium">
              <span>{translate(language, "email")}</span>
              <input
                autoComplete="email"
                className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>{translate(language, "password")}</span>
              <input
                autoComplete="current-password"
                className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
                name="password"
                required
                type="password"
              />
            </label>
            {error ? (
              <div className="rounded-md bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {error}
              </div>
            ) : null}
            <button
              className="h-10 w-full rounded-md bg-[var(--business)] px-4 text-sm font-semibold text-white hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? translate(language, "signingIn") : translate(language, "signIn")}
            </button>
          </form>

          <p className="mt-6 text-sm text-[var(--muted)]">
            {translate(language, "accountAccessNotice")}
          </p>
        </div>
      </section>
    </main>
  )
}

function LanguageToggle({
  language,
  onChange
}: {
  language: Language
  onChange: (language: Language) => void
}) {
  const nextLanguage = language === "en" ? "my" : "en"
  const label = language === "en" ? "EN" : "မြန်"
  const nextLabel = nextLanguage === "en" ? "English" : "မြန်မာ"

  return (
    <button
      aria-label={`Switch language to ${nextLabel}`}
      className="grid h-10 min-w-14 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)]"
      onClick={() => onChange(nextLanguage)}
      title={`Switch to ${nextLabel}`}
      type="button"
    >
      {label}
    </button>
  )
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}
