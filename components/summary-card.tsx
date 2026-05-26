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
    <section className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:p-4">
      <div className={`mb-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold sm:mb-3 ${toneClasses[tone]}`}>
        {label}
      </div>
      <div className="min-w-0 break-words text-lg font-semibold leading-tight tracking-normal sm:text-xl">
        {value}
      </div>
      {detail ? <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p> : null}
    </section>
  )
}
