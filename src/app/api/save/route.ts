import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 获取用户的 couple_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('couple_id')
    .eq('id', user.id)
    .single()

  const coupleId = profile?.couple_id
  if (!coupleId) {
    return NextResponse.json({ error: '请先在设置中绑定伙伴' }, { status: 403 })
  }

  const body = await req.json()
  const { identity, items: rawItems } = body
  const items = Array.isArray(rawItems) ? rawItems : (body.items ? body.items : (Array.isArray(body) ? body : [body]))
  
  if (items.length === 0) {
    return NextResponse.json({ success: true, count: 0, results: [] })
  }

  const savedResults: any[] = []

  // 1. Parallel Step 1: Resolve Events AND Upsert Categories in parallel
  const eventTitles = Array.from(new Set(items.map((i: any) => i.result?.event_title).filter(Boolean))) as string[]
  const eventMap = new Map<string, string>() // title -> id

  const categoriesToUpsert = new Set<string>()
  items.forEach((entry: any) => {
    const { result } = entry
    if (!result) return
    if (result.category) categoriesToUpsert.add(result.category)
    
    const finalAAItems = result.aa_items || result.items
    if (Array.isArray(finalAAItems)) {
      finalAAItems.forEach((item: any) => {
        if (item.category) categoriesToUpsert.add(item.category)
      })
    }
  })
  const categoryList = Array.from(categoriesToUpsert)

  await Promise.all([
    // Resolve events
    (async () => {
      if (eventTitles.length > 0) {
        const { data: existingEvents } = await supabase
          .from('events')
          .select('id, title')
          .eq('couple_id', coupleId)
          .in('title', eventTitles)

        if (existingEvents) {
          existingEvents.forEach(e => eventMap.set(e.title, e.id))
        }

        const missingTitles = eventTitles.filter(title => !eventMap.has(title))
        if (missingTitles.length > 0) {
          const { data: newEvents, error: newEventsError } = await supabase
            .from('events')
            .insert(missingTitles.map(title => ({ couple_id: coupleId, title })))
            .select('id, title')

          if (newEventsError) {
            console.error('[Save API] Failed to bulk insert events:', newEventsError)
          } else if (newEvents) {
            newEvents.forEach(e => eventMap.set(e.title, e.id))
          }
        }
      }
    })(),
    // Upsert categories
    (async () => {
      if (categoryList.length > 0) {
        const { error: catError } = await supabase.from('categories').upsert(
          categoryList.map(name => ({ name, couple_id: coupleId })),
          { onConflict: 'name' }
        )
        if (catError) {
          console.error('[Save API] Failed to upsert categories:', catError)
        }
      }
    })()
  ])

  // 2. Prepare Bulk Inserts for Gifts and Bills in memory
  const giftsToInsert: any[] = []
  const billsToInsert: any[] = []
  const billItemsMapping: any[] = []

  items.forEach((entry: any, index: number) => {
    const { type, result, source_text } = entry
    if (!type || !result) return

    const event_id = result.event_title ? (eventMap.get(result.event_title) || null) : null

    if (type === 'gift') {
      const { from, to, from_user, to_user, title, amount, description, date, category, image_urls } = result
      giftsToInsert.push({
        couple_id: coupleId,
        event_id,
        creator_id: user.id,
        from_user: from || from_user || 'me',
        to_user: to || to_user || 'her',
        title: title || '礼物',
        amount: amount ?? result.total ?? (result.items && result.items.length > 0 ? result.items[0].amount : null),
        description: description ?? null,
        category: category ?? null,
        source_text: source_text || '',
        image_urls: image_urls ?? [],
        date: date ?? new Date().toISOString().split('T')[0],
      })
    } else if (type === 'aa' || type === 'borrow') {
      const { payer, items: aaItems, aa_items, total, total_amount, my_share, note, date, image_urls, status } = result
      const billTotal = total ?? total_amount
      
      let finalMyShare = my_share || 0;
      if (type === 'borrow' && my_share === undefined) {
        finalMyShare = (payer === 'me') ? 0 : billTotal;
      }

      billsToInsert.push({
        couple_id: coupleId,
        event_id,
        creator_id: user.id,
        payer: payer || 'me',
        status: status || 'pending',
        total_amount: billTotal,
        my_share: finalMyShare,
        bill_type: type,
        source_text: source_text || '',
        note: (result.title ? `${result.title} | ${note || ''}` : note) ?? null,
        date: date ?? new Date().toISOString().split('T')[0],
        image_urls: image_urls ?? [],
      })

      billItemsMapping.push({
        originalIndex: index,
        aa_items: aa_items || aaItems,
        billTotal,
      })
    }
  })

  // 3. Parallel Step 2: Bulk Insert Gifts AND Bills in parallel
  const giftsPromise = (async () => {
    if (giftsToInsert.length > 0) {
      const { data: insertedGifts, error: giftsError } = await supabase
        .from('gifts')
        .insert(giftsToInsert)
        .select()

      if (giftsError) {
        console.error('[Save API] Failed to bulk insert gifts:', giftsError)
        throw new Error(`Gifts saving failed: ${giftsError.message}`)
      }
      return insertedGifts || []
    }
    return []
  })()

  const billsPromise = (async () => {
    if (billsToInsert.length > 0) {
      const { data: insertedBills, error: billsError } = await supabase
        .from('aa_bills')
        .insert(billsToInsert)
        .select()

      if (billsError) {
        console.error('[Save API] Failed to bulk insert aa_bills:', billsError)
        throw new Error(`Bills saving failed: ${billsError.message}`)
      }
      return insertedBills || []
    }
    return []
  })()

  let insertedGifts: any[] = []
  let insertedBills: any[] = []

  try {
    const [resGifts, resBills] = await Promise.all([giftsPromise, billsPromise])
    insertedGifts = resGifts
    insertedBills = resBills
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Saving failed' }, { status: 500 })
  }

  // 4. Map inserted records to response structure & prepare child item rows
  if (insertedGifts.length > 0) {
    insertedGifts.forEach(g => savedResults.push({ data: g, type: 'gift' }))
  }

  const allItemRows: any[] = []
  if (insertedBills.length > 0 && insertedBills.length === billsToInsert.length) {
    insertedBills.forEach((bill, i) => {
      const mapping = billItemsMapping[i]
      savedResults.push({ data: bill, type: bill.bill_type })

      const finalItems = (Array.isArray(mapping.aa_items) && mapping.aa_items.length > 0) 
        ? mapping.aa_items 
        : [{ name: '生活杂项', amount: mapping.billTotal }];

      finalItems.forEach((item: any) => {
        allItemRows.push({
          bill_id: bill.id,
          name: item.name || '支出项',
          amount: (typeof item.amount === 'number') ? item.amount : (finalItems.length === 1 ? (mapping.billTotal || 0) : 0),
          category: item.category ?? null,
        })
      })
    })
  }

  // 5. Parallel Step 3: Insert child items AND delete drafts in parallel
  const itemsPromise = (async () => {
    if (allItemRows.length > 0) {
      const { error: itemsError } = await supabase.from('aa_items').insert(allItemRows)
      if (itemsError) {
        console.error('[Save API] Failed to bulk insert aa_items:', itemsError)
      }
    }
  })()

  const deleteDraftsPromise = (async () => {
    const draftIdsToDelete = items.map((i: any) => i.draft_id).filter(Boolean);
    if (draftIdsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from('aa_drafts')
        .delete()
        .in('id', draftIdsToDelete)
      if (delError) {
        console.error('[Save API] Failed to delete drafts:', delError)
      }
    }
  })()

  await Promise.all([itemsPromise, deleteDraftsPromise])

  return NextResponse.json({ success: true, count: savedResults.length, results: savedResults })
}
