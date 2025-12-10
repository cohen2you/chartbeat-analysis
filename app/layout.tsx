import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chartbeat Analysis',
  description: 'Analyze CSV data and get key takeaways using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

