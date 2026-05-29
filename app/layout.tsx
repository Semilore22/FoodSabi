import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FoodSabi — Know your food. Sabi your ingredients.",
  description:
    "Type an ingredient, paste a label, or upload a photo. FoodSabi explains what every ingredient is, what it does, and what it means for you.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1d16" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f0" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = sessionStorage.getItem('foodsabi-theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.setAttribute('data-theme', theme);
                  } else {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
