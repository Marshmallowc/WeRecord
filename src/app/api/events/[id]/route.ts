import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id

  if (!coupleId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (await params).id

  // Fetch specific event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: eventError?.message || 'Event not found' }, { status: 404 })
  }

  // Fetch associated bills
  const { data: bills, error: billsError } = await supabase
    .from('aa_bills')
    .select('id, creator_id, payer, status, total_amount, my_share, bill_type, source_text, note, image_urls, date, created_at, event_id, aa_items(id, name, amount, category)')
    .eq('event_id', id)
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  // Fetch associated gifts
  const { data: gifts, error: giftsError } = await supabase
    .from('gifts')
    .select('id, creator_id, from_user, to_user, title, amount, description, category, source_text, image_urls, date, created_at, event_id')
    .eq('event_id', id)
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const giftItems = (gifts || []).map((g: any) => ({
    ...g,
    record_type: 'gift',
    event_title: event.title
  }))

  const billItems = (bills || []).map((b: any) => ({
    ...b,
    record_type: b.bill_type || 'aa',
    event_title: event.title
  }))

  const records = [...giftItems, ...billItems].sort((a: any, b: any) => {
    const d1 = new Date(a.date).getTime()
    const d2 = new Date(b.date).getTime()
    if (d1 !== d2) return d2 - d1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Calculate aggregates
  const total_items = records.length
  const total_amount = records.reduce((sum, item) => sum + Number(item.amount || item.total_amount || 0), 0)

  return NextResponse.json({
    success: true,
    data: {
      event: {
        ...event,
        total_items,
        total_amount
      },
      records
    }
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id

  if (!coupleId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (await params).id;
  const body = await req.json()
  const { cover_url, title } = body

  const updateData: any = {}
  if (cover_url !== undefined) updateData.cover_url = cover_url
  if (title !== undefined) updateData.title = title

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', id)
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (await params).id;
  const coupleId = profile.couple_id
  const now = new Date().toISOString()

  // 1. Soft delete associated gifts
  const { error: giftsDelError } = await supabase
    .from('gifts')
    .update({ deleted_at: now })
    .eq('event_id', id)
    .eq('couple_id', coupleId)
  if (giftsDelError) {
    return NextResponse.json({ error: giftsDelError.message }, { status: 500 })
  }

  // 2. Soft delete associated bills
  const { error: billsDelError } = await supabase
    .from('aa_bills')
    .update({ deleted_at: now })
    .eq('event_id', id)
    .eq('couple_id', coupleId)
  if (billsDelError) {
    return NextResponse.json({ error: billsDelError.message }, { status: 500 })
  }

  // 3. Soft delete the event itself
  const { error: eventDelError } = await supabase
    .from('events')
    .update({ deleted_at: now })
    .eq('id', id)
    .eq('couple_id', coupleId)

  if (eventDelError) {
    return NextResponse.json({ error: eventDelError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

