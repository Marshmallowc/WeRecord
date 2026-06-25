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
const supabaseServiceKey = env['SUPABASE_SERVICE_ROLE_KEY']

async function run() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
  
  // Authenticate
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test_me@werecord.app',
    password: '123456'
  })
  
  const userId = authData.user?.id
  const token = authData.session?.access_token
  if (!userId || !token) {
    console.error('Failed to authenticate')
    return
  }
  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', userId).single()
  const coupleId = profile?.couple_id
  console.log(`Couple ID: ${coupleId}`)

  // Title for test
  const testTitle = `日本旅游-${Date.now()}`
  console.log(`Using test title: ${testTitle}`)

  // 1. Create a scenario
  console.log('\n--- Step 1: Creating a scenario ---')
  const { data: event1, error: ev1Err } = await supabaseAdmin
    .from('events')
    .insert({ couple_id: coupleId, title: testTitle })
    .select('id')
    .single()
  
  if (ev1Err || !event1) {
    console.error('Failed to create event 1:', ev1Err)
    return
  }
  console.log(`Created event 1 ID: ${event1.id}`)

  // 2. Soft-delete the scenario
  console.log('\n--- Step 2: Soft-deleting event 1 ---')
  const deleteRes = await fetch(`http://localhost:3000/api/events/${event1.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!deleteRes.ok) {
    console.error('Failed to soft-delete event 1:', await deleteRes.text())
    await supabaseAdmin.from('events').delete().eq('id', event1.id)
    return
  }
  console.log('Event 1 soft-deleted successfully')

  // 3. Confirm a new bill with the same scenario title via /api/save
  console.log('\n--- Step 3: Saving a new bill with same title via /api/save ---')
  const saveRes = await fetch('http://localhost:3000/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      items: [
        {
          type: 'aa',
          source_text: '测试方案A重复场景',
          result: {
            payer: 'me',
            total_amount: 100,
            my_share: 50,
            note: '日本旅游测试账单',
            date: '2026-06-25',
            event_title: testTitle
          }
        }
      ]
    })
  })

  if (!saveRes.ok) {
    console.error('Failed to save bill:', await saveRes.text())
    await supabaseAdmin.from('events').delete().eq('id', event1.id)
    return
  }
  const saveResult = await saveRes.json()
  console.log('Save result:', saveResult)

  // 4. Query events to verify both exist
  console.log('\n--- Step 4: Verifying database state ---')
  const { data: dbEvents } = await supabaseAdmin
    .from('events')
    .select('id, title, deleted_at')
    .eq('couple_id', coupleId)
    .eq('title', testTitle)
  
  console.log('Events in DB:', dbEvents)
  if (dbEvents && dbEvents.length === 2) {
    console.log('SUCCESS: Two events with the same title exist (one active, one soft-deleted)')
  } else {
    console.error('FAILURE: Expected 2 events, got:', dbEvents?.length)
  }

  // 5. Test restore renaming conflict
  console.log('\n--- Step 5: Testing restore conflict ---')
  const restoreRes = await fetch('http://localhost:3000/api/trash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      id: event1.id, // The soft-deleted one
      type: 'event'
    })
  })

  if (!restoreRes.ok) {
    console.error('Failed to restore event 1:', await restoreRes.text())
  } else {
    const restoreResult = await restoreRes.json()
    console.log('Restore response:', restoreResult)

    // Check restored event title in DB
    const { data: restoredEvent } = await supabaseAdmin
      .from('events')
      .select('id, title, deleted_at')
      .eq('id', event1.id)
      .single()
    
    console.log('Restored event status:', restoredEvent)
    if (restoredEvent && restoredEvent.title === `${testTitle} (已恢复-1)`) {
      console.log('SUCCESS: Event restored and renamed correctly to avoid conflict')
    } else {
      console.error('FAILURE: Restoration title was not renamed correctly')
    }
  }

  // Clean up
  console.log('\n--- Step 6: Cleaning up test data ---')
  if (dbEvents) {
    for (const e of dbEvents) {
      await supabaseAdmin.from('aa_bills').delete().eq('event_id', e.id)
      await supabaseAdmin.from('events').delete().eq('id', e.id)
    }
  }
  console.log('Clean up completed')
}

run().catch(console.error)
