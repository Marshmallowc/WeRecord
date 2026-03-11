import ClientStatsPage from './ClientStatsPage'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default function StatsServerPage() {
  return <ClientStatsPage />
}
