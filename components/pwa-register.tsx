"use client"

import { useEffect } from "react"

interface PwaRegisterProps {
  nonce: string
}

export function PwaRegister({ nonce }: PwaRegisterProps) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js")
      } catch {
        // The app should remain usable even if the browser rejects service workers.
      }
    }

    void registerServiceWorker()
  }, [nonce])

  return null
}
