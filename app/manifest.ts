import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SplitLedger",
    short_name: "SplitLedger",
    description: "Shared business and private personal expense tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFB",
    theme_color: "#1F2937",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/splitledger-mark.svg",
        sizes: "64x64",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/splitledger-mark.svg",
        sizes: "64x64",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/splitledger-logo.svg",
        sizes: "224x64",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  }
}
