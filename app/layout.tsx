import type { Metadata, Viewport } from "next"
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
  themeColor: "#1F2937"
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
