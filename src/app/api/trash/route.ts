import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id
  if (!coupleId) return NextResponse.json({ data: [] })

  // 1. Fetch soft-deleted events
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('couple_id', coupleId)
    .not('deleted_at', 'is', null)

  // 2. Fetch soft-deleted gifts
  const { data: gifts, error: giftsError } = await supabase
    .from('gifts')
    .select('id, creator_id, from_user, to_user, title, amount, description, category, date, deleted_at, event_id')
    .eq('couple_id', coupleId)
    .not('deleted_at', 'is', null)

  // 3. Fetch soft-deleted bills
  const { data: bills, error: billsError } = await supabase
    .from('aa_bills')
    .select('id, creator_id, payer, status, total_amount, my_share, bill_type, note, date, deleted_at, event_id')
    .eq('couple_id', coupleId)
    .not('deleted_at', 'is', null)

  if (eventsError || giftsError || billsError) {
    return NextResponse.json({ error: 'Failed to fetch trash items' }, { status: 500 })
  }

  // Format all items for consistent consumption in the frontend
  const formattedEvents = (events || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    amount: null,
    date: e.created_at, // Use creation date as fallback
    deleted_at: e.deleted_at,
    record_type: 'event',
  }))

  const formattedGifts = (gifts || []).map((g: any) => ({
    id: g.id,
    title: g.title,
    amount: g.amount,
    date: g.date,
    deleted_at: g.deleted_at,
    record_type: 'gift',
  }))

  const formattedBills = (bills || []).map((b: any) => ({
    id: b.id,
    title: b.note || 'AA账单',
    amount: b.total_amount,
    date: b.date,
    deleted_at: b.deleted_at,
    record_type: b.bill_type || 'aa',
  }))

  const trashItems = [...formattedEvents, ...formattedGifts, ...formattedBills].sort((a: any, b: any) => {
    return new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
  })

  return NextResponse.json({ data: trashItems })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id
  if (!coupleId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, type } = body
  if (!id || !type) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  if (type === 'event') {
    // Fetch the soft-deleted event to check its title
    const { data: eventToRestore, error: fetchErr } = await supabase
      .from('events')
      .select('title')
      .eq('id', id)
      .eq('couple_id', coupleId)
      .single()

    if (fetchErr || !eventToRestore) {
      return NextResponse.json({ error: fetchErr?.message || 'Event not found' }, { status: 404 })
    }

    // Check if an active event with the same title already exists
    let targetTitle = eventToRestore.title
    const { data: activeEvent } = await supabase
      .from('events')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('title', targetTitle)
      .is('deleted_at', null)
      .maybeSingle()

    // If there is an active event with the same title, rename the restored one
    if (activeEvent) {
      let isConflict = true
      let suffixCount = 1
      while (isConflict) {
        const testTitle = `${eventToRestore.title} (已恢复-${suffixCount})`
        const { data: testActive } = await supabase
          .from('events')
          .select('id')
          .eq('couple_id', coupleId)
          .eq('title', testTitle)
          .is('deleted_at', null)
          .maybeSingle()
        if (!testActive) {
          targetTitle = testTitle
          isConflict = false
        } else {
          suffixCount++
        }
      }
    }

    // Restore the event (and update title if it was renamed)
    const { error: evError } = await supabase
      .from('events')
      .update({ deleted_at: null, title: targetTitle })
      .eq('id', id)
      .eq('couple_id', coupleId)
    if (evError) return NextResponse.json({ error: evError.message }, { status: 500 })

    // Restore associated gifts and bills that are soft deleted
    await supabase.from('gifts').update({ deleted_at: null }).eq('event_id', id).eq('couple_id', coupleId)
    await supabase.from('aa_bills').update({ deleted_at: null }).eq('event_id', id).eq('couple_id', coupleId)

  } else if (type === 'gift') {
    const { error } = await supabase
      .from('gifts')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('couple_id', coupleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  } else {
    const { error } = await supabase
      .from('aa_bills')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('couple_id', coupleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id
  if (!coupleId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id || !type) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  if (type === 'event') {
    // Permanently delete associated gifts first
    await supabase.from('gifts').delete().eq('event_id', id).eq('couple_id', coupleId)
    // Permanently delete associated bills (cascades to aa_items)
    await supabase.from('aa_bills').delete().eq('event_id', id).eq('couple_id', coupleId)
    // Permanently delete event
    const { error } = await supabase.from('events').delete().eq('id', id).eq('couple_id', coupleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  } else if (type === 'gift') {
    const { error } = await supabase.from('gifts').delete().eq('id', id).eq('couple_id', coupleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  } else {
    const { error } = await supabase.from('aa_bills').delete().eq('id', id).eq('couple_id', coupleId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
