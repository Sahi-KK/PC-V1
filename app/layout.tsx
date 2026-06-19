import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PC-V1 Portal',
  description: 'Exclusive schedule portal for PC-V1 committee members',
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
