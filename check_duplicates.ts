import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Read env
const envFilePath = path.resolve(__dirname, '.env.local')
const envFile = fs.readFileSync(envFilePath, 'utf-8')
const env: Record<string, string> = {}
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=')
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim()
    }
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  // Authenticate
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test_me@werecord.app',
    password: '123456'
  })
  
  const userId = authData.user?.id
  if (!userId) {
    console.error('Failed to authenticate')
    return
  }
  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', userId).single()
  const coupleId = profile?.couple_id
  
  console.log(`Couple ID: ${coupleId}`)
  
  // Query bills for this event
  const { data: bills } = await supabase
    .from('aa_bills')
    .select('id, note, total_amount, date, source_text, created_at')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
  
  console.log(`Total active bills in database: ${bills?.length}`)
  
  // Count by title and amount to find duplicates
  const counts: Record<string, number> = {}
  bills?.forEach(b => {
    const key = `${b.date}_${b.note}_${b.total_amount}`
    counts[key] = (counts[key] || 0) + 1
  })
  
  const duplicates = Object.entries(counts).filter(([_, count]) => count > 1)
  console.log(`Duplicate groups found: ${duplicates.length}`)
  if (duplicates.length > 0) {
    console.log('Duplicates detail (first 10):')
    console.log(duplicates.slice(0, 10))
  }
}

run().catch(console.error)
