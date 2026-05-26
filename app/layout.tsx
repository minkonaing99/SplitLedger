import type { Metadata, Viewport } from "next"
import { headers } from "next/headers"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

export const metadata: Metadata = {
  applicationName: "SplitLedger",
  title: "SplitLedger",
  description: "Shared business and private personal expense tracking.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SplitLedger"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: "/splitledger-mark.svg",
    apple: "/splitledger-mark.svg"
  }
}

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#1F2937",
  viewportFit: "cover",
  width: "device-width"
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Reading x-nonce causes Next.js to propagate it to its own hydration scripts.
  const nonce = (await headers()).get("x-nonce") ?? ""

  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister nonce={nonce} />
      </body>
    </html>
  )
}
