"use client"

import { useEffect } from "react"

export function PwaRegister() {
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
  }, [])

  return null
}
