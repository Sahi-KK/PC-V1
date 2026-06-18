import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IIM Rohtak – Term IV Academic Calendar',
  description: 'Academic schedule management portal for IIM Rohtak Term IV (PGP 16)',
  keywords: ['IIM Rohtak', 'Academic Calendar', 'Term IV', 'PGP 16'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
