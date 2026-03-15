import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'
import { IdentityProvider } from '@/context/IdentityContext'
import AppShell from '@/components/AppShell'
import { cookies } from 'next/headers'
import type { UserType } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: 'WeRecord - 情侣账本',
  description: '记录我们之间的礼物与花销',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const initialIdentity = (cookieStore.get('werecord_identity')?.value as UserType) || null

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <meta name="theme-color" content="#0f0e0d" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <IdentityProvider>
            <AppShell>{children}</AppShell>
          </IdentityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
