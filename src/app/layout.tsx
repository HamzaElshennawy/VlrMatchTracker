import type { Metadata } from 'next'
import React from 'react'
import { initializeApp } from '@/lib/init'

export const metadata: Metadata = {
  title: 'VLR.gg Scraper API',
  description: 'Next.js TypeScript API for scraping Valorant esports data from VLR.gg',
}

// Initialize the app on startup
if (typeof window === 'undefined') {
  initializeApp();
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