export function isTrustedOrigin(input: {
  appOrigin?: string
  host?: string | null
  origin?: string | null
  protocol: string
  referer?: string | null
}): boolean {
  const requestOrigin = readRequestOrigin(input.origin, input.referer)

  if (!requestOrigin) {
    return false
  }

  return getTrustedOrigins(input).has(requestOrigin)
}

export function readRequestOrigin(
  origin?: string | null,
  referer?: string | null
): string | null {
  if (origin) {
    return normalizeOrigin(origin)
  }

  if (!referer) {
    return null
  }

  return normalizeOrigin(referer)
}

function getTrustedOrigins(input: {
  appOrigin?: string
  host?: string | null
  protocol: string
}): Set<string> {
  const trustedOrigins = new Set<string>()

  if (input.appOrigin) {
    const appOrigin = normalizeOrigin(input.appOrigin)

    if (appOrigin) {
      trustedOrigins.add(appOrigin)
    }
  }

  if (input.host) {
    trustedOrigins.add(`${input.protocol}://${input.host}`)
  }

  return trustedOrigins
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return ""
  }
}
