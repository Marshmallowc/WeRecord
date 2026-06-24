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

  // First fetch all events for this couple
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  // To get aggregates, we can query gifts and aa_bills that have event_id
  const { data: bills } = await supabase
    .from('aa_bills')
    .select('event_id, total_amount')
    .eq('couple_id', coupleId)
    .not('event_id', 'is', null)

  const { data: gifts } = await supabase
    .from('gifts')
    .select('event_id, amount')
    .eq('couple_id', coupleId)
    .not('event_id', 'is', null)

  // Calculate aggregates
  const eventAggregates: Record<string, { total_items: number, total_amount: number }> = {}

  bills?.forEach(b => {
    if (!b.event_id) return
    if (!eventAggregates[b.event_id]) eventAggregates[b.event_id] = { total_items: 0, total_amount: 0 }
    eventAggregates[b.event_id].total_items += 1
    eventAggregates[b.event_id].total_amount += Number(b.total_amount || 0)
  })

  gifts?.forEach(g => {
    if (!g.event_id) return
    if (!eventAggregates[g.event_id]) eventAggregates[g.event_id] = { total_items: 0, total_amount: 0 }
    eventAggregates[g.event_id].total_items += 1
    eventAggregates[g.event_id].total_amount += Number(g.amount || 0)
  })

  const enrichedEvents = events.map(e => ({
    ...e,
    total_items: eventAggregates[e.id]?.total_items || 0,
    total_amount: eventAggregates[e.id]?.total_amount || 0
  }))

  return NextResponse.json({ data: enrichedEvents })
}
