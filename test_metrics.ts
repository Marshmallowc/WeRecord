import { createClient } from '@supabase/supabase-js'
import { AIAgent } from './src/lib/agents/agent'
import { AgentContext } from './src/lib/agents/registry'
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

process.env.DEEPSEEK_API_KEY = env['DEEPSEEK_API_KEY']

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase env vars missing!')
  process.exit(1)
}

async function runMetrics() {
  console.log('=== Starting Real Database & LLM Metrics Test ===')
  
  // 1. Supabase Initialization
  const tInitStart = performance.now()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  })
  const tInitEnd = performance.now()
  const initDuration = tInitEnd - tInitStart

  // 2. Authentication
  console.log('Authenticating as test_me@werecord.app...')
  const tAuthStart = performance.now()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test_me@werecord.app',
    password: '123456'
  })
  if (authError) {
    throw new Error(`Auth failed: ${authError.message}`)
  }
  const userId = authData.user.id
  const tAuthEnd = performance.now()
  const authDuration = tAuthEnd - tAuthStart
  console.log(`Authenticated successfully in ${authDuration.toFixed(2)}ms. User ID: ${userId}`)

  // 3. Couple details retrieval
  const tProfileStart = performance.now()
  const { data: profile } = await supabase
    .from('profiles')
    .select('couple_id, display_name, identity')
    .eq('id', userId)
    .single()

  const coupleId = profile?.couple_id
  if (!coupleId) {
    throw new Error('No couple_id found for test user.')
  }
  const tProfileEnd = performance.now()
  const profileDuration = tProfileEnd - tProfileStart
  console.log(`Profile retrieved in ${profileDuration.toFixed(2)}ms. Couple ID: ${coupleId}`)

  // Create context
  const context: AgentContext = {
    userId,
    coupleId,
    identity: 'me',
    displayName: profile.display_name || '宝宝大人',
    partnerName: '小可爱',
    supabase
  }

  // Read failure case file
  const tripLogPath = path.resolve(__dirname, '../werecord-app/失败案例.md')
  const tripLog = fs.readFileSync(tripLogPath, 'utf-8')
  
  const lines = tripLog.split('\n')
  const userInput = lines.slice(4).join('\n') // Start from Prompt1 text

  const chatMessages = [
    { role: 'user' as const, content: userInput }
  ]

  const agent = new AIAgent(context)

  // Metric variables
  let llmIteration1Start = 0
  let llmIteration1End = 0
  let addRecordStart = 0
  let addRecordEnd = 0
  let llmIteration2Start = 0
  let llmIteration2End = 0
  let totalStart = performance.now()
  let totalEnd = 0

  console.log(`\n--- Sending Prompt to LLM (${userInput.length} chars) ---`)

  const result = await agent.run(chatMessages, (step) => {
    const now = performance.now()
    if (step.type === 'status') {
      if (step.status === 'thinking') {
        if (llmIteration1Start === 0) {
          llmIteration1Start = now
          console.log('[Metric] LLM Iteration 1 (Parsing & Extracting) started...')
        } else if (addRecordEnd !== 0 && llmIteration2Start === 0) {
          llmIteration2Start = now
          console.log('[Metric] LLM Iteration 2 (Final Response Generation) started...')
        }
      } else if (step.status === 'calling_tool' && step.tool === 'add_record') {
        if (llmIteration1End === 0) {
          llmIteration1End = now
          console.log(`[Metric] LLM Iteration 1 finished. Time: ${(llmIteration1End - llmIteration1Start).toFixed(2)}ms`)
        }
        addRecordStart = now
        console.log('[Metric] Database writing (add_record) started...')
      } else if (step.status === 'tool_complete' && step.tool === 'add_record') {
        addRecordEnd = now
        console.log(`[Metric] Database writing (add_record) completed. Time: ${(addRecordEnd - addRecordStart).toFixed(2)}ms`)
      }
    }
  })

  totalEnd = performance.now()
  llmIteration2End = totalEnd

  const totalDuration = totalEnd - totalStart
  const totalLlmTime = (llmIteration1End - llmIteration1Start) + (llmIteration2End - llmIteration2Start)
  const totalDbWriteTime = addRecordEnd - addRecordStart
  const numRecords = result.records?.length || 0

  // 4. One-Key Confirmation Test (Simulating /api/save)
  console.log('\n--- Simulating Frontend "One-Key Confirmation" ---')
  if (!result.records || result.records.length === 0) {
    console.error('No drafts were generated. Cannot test confirmation.')
    return
  }

  const saveItems = result.records.map(record => {
    let type = record.record_type
    if (type === 'gift') {
      return {
        draft_id: record.id,
        type: 'gift',
        result: {
          from_user: record.from_user,
          to_user: record.to_user,
          title: record.title,
          amount: record.amount,
          description: record.description,
          category: record.category,
          source_text: record.source_text,
          event_title: record.event_title,
          image_urls: record.image_urls,
          date: record.date
        }
      }
    } else {
      return {
        draft_id: record.id,
        type: record.record_type, // aa or borrow
        result: {
          payer: record.payer,
          status: record.status,
          total_amount: record.total_amount,
          my_share: record.my_share,
          source_text: record.source_text,
          event_title: record.event_title,
          image_urls: record.image_urls,
          note: record.note,
          title: record.title,
          aa_items: record.aa_items,
          date: record.date
        }
      }
    }
  })

  // Start measure confirmation
  const tConfirmStart = performance.now()
  
  const confirmedBills: string[] = []
  const confirmedGifts: string[] = []
  const eventsCreated: string[] = []

  for (const entry of saveItems) {
    const { type, result: itemResult } = entry
    
    let event_id: string | null = null;
    if (itemResult.event_title) {
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('couple_id', coupleId)
        .eq('title', itemResult.event_title)
        .maybeSingle()
      
      if (existingEvent) {
        event_id = existingEvent.id;
      } else {
        const { data: newEvent } = await supabase
          .from('events')
          .insert({ couple_id: coupleId, title: itemResult.event_title })
          .select('id')
          .single()
        if (newEvent) {
          event_id = newEvent.id
          eventsCreated.push(newEvent.id)
        }
      }
    }

    if (type === 'gift') {
      const { from_user, to_user, title, amount, description, date, category, image_urls } = itemResult
      if (category) {
        await supabase.from('categories').upsert({ 
          name: category, 
          couple_id: coupleId 
        }, { onConflict: 'couple_id, name' })
      }
      const { data, error } = await supabase.from('gifts').insert([{
        couple_id: coupleId,
        event_id,
        creator_id: userId,
        from_user: from_user || 'me',
        to_user: to_user || 'her',
        title,
        amount,
        description: description ?? null,
        category: category ?? null,
        source_text: itemResult.source_text,
        image_urls: image_urls ?? [],
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()
      if (!error && data) {
        confirmedGifts.push(data.id)
      }
    } else if (type === 'aa' || type === 'borrow') {
      const { payer, aa_items, total_amount, my_share, note, date, image_urls, status } = itemResult
      const categories = Array.from(new Set(((aa_items || []) as any[]).map(i => i.category).filter(Boolean)))

      if (categories.length > 0) {
        await supabase.from('categories').upsert(
          categories.map(cat => ({ name: cat, couple_id: coupleId })), 
          { onConflict: 'couple_id, name' }
        )
      }

      const { data: bill, error: billError } = await supabase.from('aa_bills').insert([{
        couple_id: coupleId,
        event_id,
        creator_id: userId,
        payer: payer || 'me',
        status: status || 'pending',
        total_amount,
        my_share,
        bill_type: type,
        source_text: itemResult.source_text,
        image_urls: image_urls ?? [],
        note,
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()

      if (!billError && bill) {
        confirmedBills.push(bill.id)
        const finalItems = (Array.isArray(aa_items) && aa_items.length > 0) 
          ? aa_items 
          : [{ name: '生活杂项', amount: total_amount }];

        const itemRows = finalItems.map(item => ({
          bill_id: bill.id,
          name: item.name || '支出项',
          amount: item.amount,
          category: item.category ?? null,
        }))

        const { error: itemsError } = await supabase.from('aa_items').insert(itemRows)
        if (itemsError) {
          console.error('[Metrics Test] aa_items insert failed:', itemsError)
        }
      } else if (billError) {
        console.error('[Metrics Test] aa_bills insert failed:', billError)
      }
    }
  }

  // Cleanup drafts
  const draftIdsToDelete = saveItems.map(i => i.draft_id).filter(Boolean)
  if (draftIdsToDelete.length > 0) {
    await supabase.from('aa_drafts').delete().in('id', draftIdsToDelete)
  }

  const tConfirmEnd = performance.now()
  const confirmDuration = tConfirmEnd - tConfirmStart
  const totalConfirmed = confirmedBills.length + confirmedGifts.length

  console.log('\n--- One-Key Confirmation Metrics ---')
  console.log(`Total Confirmation Duration: ${(confirmDuration / 1000).toFixed(2)}s`)
  console.log(`Confirmed Bills Count: ${confirmedBills.length}`)
  console.log(`Confirmed Gifts Count: ${confirmedGifts.length}`)
  console.log(`Average confirmation time per record: ${(confirmDuration / totalConfirmed).toFixed(2)}ms`)
  console.log(`Confirmation throughput: ${(totalConfirmed / (confirmDuration / 1000)).toFixed(2)} records/sec`)

  // Output all collected metrics in a clean JSON format so it can be parsed easily
  const metricsReport = {
    initDurationMs: initDuration,
    authDurationMs: authDuration,
    profileDurationMs: profileDuration,
    totalRoundtripMs: totalDuration,
    totalLlmMs: totalLlmTime,
    llmIteration1Ms: llmIteration1End - llmIteration1Start,
    llmIteration2Ms: llmIteration2End - llmIteration2Start,
    totalDbWriteMs: totalDbWriteTime,
    numRecords,
    avgDraftWriteMs: totalDbWriteTime / numRecords,
    draftThroughputPerSec: numRecords / (totalDbWriteTime / 1000),
    confirmDurationMs: confirmDuration,
    totalConfirmed,
    avgConfirmMs: confirmDuration / totalConfirmed,
    confirmThroughputPerSec: totalConfirmed / (confirmDuration / 1000)
  }

  console.log('\nMETRICS_REPORT_JSON_START')
  console.log(JSON.stringify(metricsReport, null, 2))
  console.log('METRICS_REPORT_JSON_END\n')

  // 5. Clean up from Database
  console.log('Cleaning up test records from database...')
  const tCleanupStart = performance.now()
  if (confirmedBills.length > 0) {
    const { error } = await supabase.from('aa_bills').delete().in('id', confirmedBills)
    if (error) console.error('Failed to clean up aa_bills:', error)
  }
  if (confirmedGifts.length > 0) {
    const { error } = await supabase.from('gifts').delete().in('id', confirmedGifts)
    if (error) console.error('Failed to clean up gifts:', error)
  }
  if (eventsCreated.length > 0) {
    const { error } = await supabase.from('events').delete().in('id', eventsCreated)
    if (error) console.error('Failed to clean up events:', error)
  }
  const tCleanupEnd = performance.now()
  console.log(`Cleanup completed in ${(tCleanupEnd - tCleanupStart).toFixed(2)}ms`)
}

runMetrics().catch(console.error)
