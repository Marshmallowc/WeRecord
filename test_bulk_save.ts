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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars missing!')
  process.exit(1)
}

async function run() {
  console.log('=== Starting Real HTTP API Bulk Save Performance Test ===')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  })

  // 1. Authenticate
  console.log('Authenticating...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test_me@werecord.app',
    password: '123456'
  })
  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`)
  }
  const token = authData.session.access_token
  const userId = authData.user.id
  
  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', userId).single()
  const coupleId = profile?.couple_id
  if (!coupleId) {
    throw new Error('No couple_id found.')
  }

  // 2. Build 58 mock drafts in memory
  console.log('Preparing 58 test drafts...')
  const mockDrafts = Array.from({ length: 58 }).map((_, i) => {
    const tempId = `test-bulk-draft-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`
    const date = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().split('T')[0]
    
    const payload = {
      id: tempId,
      record_type: 'aa',
      is_draft: true,
      payer: 'me',
      status: 'pending',
      total_amount: 10 + i,
      my_share: (10 + i) / 2,
      source_text: `批量测试账单第 ${i} 笔，消费了 ${10 + i} 元`,
      event_title: '威海烟台青岛之旅',
      image_urls: [],
      note: null,
      title: `批量测试-${i}`,
      aa_items: [{ id: `draft-item-${tempId}-0`, name: `明细项-${i}`, amount: 10 + i, category: '测试' }],
      date,
    }

    return {
      id: tempId,
      couple_id: coupleId,
      creator_id: userId,
      record_type: 'aa',
      payload,
      created_at: new Date().toISOString()
    }
  })

  // 3. Bulk insert drafts into the database first so the save API can delete them
  console.log('Bulk inserting 58 drafts into aa_drafts...')
  const { error: draftsError } = await supabase.from('aa_drafts').insert(mockDrafts)
  if (draftsError) {
    throw new Error(`Failed to insert drafts: ${draftsError.message}`)
  }
  console.log('58 drafts created in database successfully.')

  // 4. Send HTTP POST request to local Next.js save API
  const saveItems = mockDrafts.map(d => ({
    draft_id: d.id,
    type: 'aa',
    source_text: d.payload.source_text,
    result: d.payload
  }))

  const requestBody = {
    identity: 'me',
    items: saveItems
  }

  console.log('\nSending HTTP POST to http://10.145.156.84:3000/api/save...')
  const tStart = performance.now()
  
  const response = await fetch('http://10.145.156.84:3000/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(requestBody)
  })

  const tEnd = performance.now()
  const duration = tEnd - tStart

  console.log(`HTTP Response status: ${response.status} ${response.statusText}`)
  const responseBody = await response.json()
  
  if (!response.ok || !responseBody.success) {
    console.error('API Error:', responseBody)
    // Clean up drafts since they weren't deleted by the API
    await supabase.from('aa_drafts').delete().in('id', mockDrafts.map(d => d.id))
    return
  }

  const createdBillIds = responseBody.results.map((r: any) => r.data?.id).filter(Boolean)
  console.log('\n=== Bulk Save Performance Results ===')
  console.log(`Total HTTP API Roundtrip Time: ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`)
  console.log(`Confirmed Bills count: ${responseBody.count}`)
  console.log(`Average confirmation time per record: ${(duration / responseBody.count).toFixed(2)}ms`)
  console.log(`Confirmed Throughput: ${(responseBody.count / (duration / 1000)).toFixed(2)} records/sec`)

  // 5. Clean up created bills
  console.log('\nCleaning up created test records from database...')
  if (createdBillIds.length > 0) {
    const { error: cleanupError } = await supabase.from('aa_bills').delete().in('id', createdBillIds)
    if (cleanupError) {
      console.error('Failed to clean up bills:', cleanupError)
    } else {
      console.log(`Cleaned up ${createdBillIds.length} bills successfully.`)
    }
  }

  // Clean up created event "威海烟台青岛之旅" if needed (or we can just keep it, but let's delete it if it was created)
  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('couple_id', coupleId)
    .eq('title', '威海烟台青岛之旅')
    .maybeSingle()
  if (event) {
    // Delete the event
    await supabase.from('events').delete().eq('id', event.id)
    console.log('Cleaned up test event successfully.')
  }
}

run().catch(console.error)
