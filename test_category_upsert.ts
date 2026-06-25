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
  
  console.log('--- Test 1: Upsert with onConflict: name ---')
  const r1 = await supabase.from('categories').upsert(
    [{ name: 'TestCatTemp', couple_id: coupleId }],
    { onConflict: 'name' }
  )
  console.log('Result name:', r1.error ? r1.error : 'Success')

  console.log('--- Test 2: Upsert with onConflict: couple_id,name ---')
  const r2 = await supabase.from('categories').upsert(
    [{ name: 'TestCatTemp', couple_id: coupleId }],
    { onConflict: 'couple_id,name' }
  )
  console.log('Result couple_id,name:', r2.error ? r2.error : 'Success')

  console.log('--- Test 3: Upsert with onConflict: couple_id, name (with space) ---')
  const r3 = await supabase.from('categories').upsert(
    [{ name: 'TestCatTemp', couple_id: coupleId }],
    { onConflict: 'couple_id, name' }
  )
  console.log('Result couple_id, name:', r3.error ? r3.error : 'Success')
}

run().catch(console.error)
