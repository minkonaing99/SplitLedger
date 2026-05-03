interface SummaryCardProps {
  label: string
  value: string
  tone?: "business" | "personal" | "neutral"
  detail?: string
}

const toneClasses = {
  business: "bg-[var(--business-soft)] text-[var(--business)]",
  personal: "bg-[var(--personal-soft)] text-[var(--personal)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--text)]"
}

export function SummaryCard({
  label,
  value,
  tone = "neutral",
  detail
}: SummaryCardProps) {
  return (
    <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className={`mb-3 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
        {label}
      </div>
      <div className="min-w-0 break-words text-xl font-semibold leading-tight tracking-normal">
        {value}
      </div>
      {detail ? <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p> : null}
    </section>
  )
}
