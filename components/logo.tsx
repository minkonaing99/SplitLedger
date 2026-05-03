interface LogoProps {
  compact?: boolean
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <img
      alt="SplitLedger"
      className={compact ? "h-10 w-10" : "h-12 w-auto"}
      height={compact ? 40 : 64}
      src={compact ? "/splitledger-mark.svg" : "/splitledger-logo.svg"}
      width={compact ? 40 : 224}
    />
  )
}
