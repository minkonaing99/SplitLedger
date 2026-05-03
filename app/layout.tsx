import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SplitLedger",
  description: "Shared business and private personal expense tracking.",
  icons: {
    icon: "/splitledger-mark.svg",
    apple: "/splitledger-mark.svg"
  }
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
