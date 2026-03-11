import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')
  const payer = searchParams.get('payer')
  const type = searchParams.get('type') // 'gift' or 'aa'

  let giftQuery = supabase.from('gifts').select('id, from_user, to_user, title, amount, description, category, source_text, image_urls, date, created_at')
  let billQuery = supabase.from('aa_bills').select('id, payer, status, total_amount, my_share, source_text, note, image_urls, date, created_at, aa_items(id, name, amount, category)')

  // Apply filters
  if (search) {
    giftQuery = giftQuery.ilike('title', `%${search}%`)
    billQuery = billQuery.ilike('source_text', `%${search}%`)
  }
  if (category) {
    giftQuery = giftQuery.eq('category', category)
    // For bills, we check if any of its items match the category
    // This is a bit tricky with Supabase JS directly on nested, 
    // better to filter in JS or use a more complex join if needed.
    // Simplifying: we'll check the 'category' if it was added to bill top-level or just filter items
  }
  if (payer) {
    giftQuery = giftQuery.eq('from_user', payer)
    billQuery = billQuery.eq('payer', payer)
  }

  const [giftsRes, billsRes] = await Promise.all([
    giftQuery.order('created_at', { ascending: false }).limit(limit),
    billQuery.order('created_at', { ascending: false }).limit(limit),
  ])

  let giftItems = (giftsRes.data ?? []).map(g => ({ ...g, record_type: 'gift' }))
  let billItems = (billsRes.data ?? []).map(b => ({ ...b, record_type: 'aa' }))

  // Post-filter for nested categories in bills if needed
  if (category) {
    billItems = billItems.filter(b => b.aa_items?.some((i: any) => i.category === category))
  }

  let combined = [...giftItems, ...billItems]

  if (type) {
    combined = combined.filter(r => r.record_type === type)
  }

  combined = combined.sort((a, b) => {
    const d1 = new Date(a.date).getTime()
    const d2 = new Date(b.date).getTime()
    if (d1 !== d2) return d2 - d1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }).slice(0, limit)

  return NextResponse.json({ data: combined })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, type, ...updates } = body

  if (!id || !type) return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })

  if (type === 'gift') {
    const { error } = await supabase.from('gifts').update({
      title: updates.title,
      amount: updates.amount,
      category: updates.category,
      date: updates.date,
      description: updates.description,
      from_user: updates.from_user,
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // For AA bills, update main record. Updating items is more complex (requires delete/re-insert usually)
    // For now, support updating main status and note/date
    const { error } = await supabase.from('aa_bills').update({
      status: updates.status,
      note: updates.note,
      date: updates.date,
      payer: updates.payer,
      total_amount: updates.total_amount,
      my_share: updates.my_share,
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id || !type) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  if (type === 'gift') {
    await supabase.from('gifts').delete().eq('id', id)
  } else {
    await supabase.from('aa_bills').delete().eq('id', id)
  }
  return NextResponse.json({ success: true })
}
