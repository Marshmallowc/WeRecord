import type { Metadata } from 'next'
import './globals.css'
import { IdentityProvider } from '@/context/IdentityContext'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'WeRecord - 情侣账本',
  description: '记录我们之间的礼物与花销',
  manifest: '/manifest.json',
  themeColor: '#0f0e0d',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WeRecord',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning>
        <IdentityProvider>
          <AppShell>{children}</AppShell>
        </IdentityProvider>
      </body>
    </html>
  )
}
