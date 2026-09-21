import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Haveli Stage',
  description: 'The Haveli stage — LED content and lighting, previewed live in 3D.',
}
export const viewport: Viewport = { themeColor: '#0f0e0c', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="dot-grid min-h-full">{children}</body>
    </html>
  )
}
