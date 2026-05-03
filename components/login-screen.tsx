"use client"

import { useState } from "react"
import { Logo } from "@/components/logo"
import { demoCredentials, users } from "@/lib/mock-data"
import type { User } from "@/lib/types"

interface LoginScreenProps {
  onLogin: (user: User) => Promise<void>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
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
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm lg:grid-cols-[1fr_420px]">
        <div className="bg-[var(--surface-muted)] p-6 sm:p-8 lg:p-10">
          <Logo />
          <h1 className="mt-10 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">
            Shared business costs, private personal spending.
          </h1>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Business" value="Shared" />
            <Metric label="Personal" value="Private" />
            <Metric label="Access" value="Both" />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Sign in</h2>
          <form action={handleSubmit} autoComplete="off" className="mt-6 space-y-4">
            <label className="block space-y-1 text-sm font-medium">
              <span>Email</span>
              <input
                autoComplete="off"
                className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
                name="email"
                placeholder="aurora@example.com"
                required
                type="email"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              <span>Password</span>
              <input
                autoComplete="new-password"
                className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 outline-none focus:border-[var(--business)]"
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
              className="h-11 w-full rounded-md bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--business)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-[var(--line)] p-4">
            <div className="mb-3 text-sm font-semibold">Demo accounts</div>
            <div className="space-y-3">
              {demoCredentials.map((credential) => (
                <DemoAccount credential={credential} key={credential.userId} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

interface DemoAccountProps {
  credential: {
    userId: string
    email: string
    password: string
  }
}

function DemoAccount({ credential }: DemoAccountProps) {
  const user = users.find((item) => item.id === credential.userId)

  return (
    <div className="rounded-md bg-[var(--surface-muted)] p-3 text-sm">
      <div className="font-medium">{user?.name ?? credential.email}</div>
      <div className="mt-1 text-[var(--muted)]">{credential.email}</div>
      <div className="text-[var(--muted)]">{credential.password}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] p-4">
      <div className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  )
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}
