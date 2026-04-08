import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: fetch AA bills with items
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ data: [] })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const payer = searchParams.get('payer')

  let query = supabase
    .from('aa_bills')
    .select('*, aa_items(*)')
    .eq('couple_id', profile.couple_id)
    .order('date', { ascending: false })

  if (status) query = query.eq('status', status)
  if (payer) query = query.eq('payer', payer)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: create AA bill with items
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: '请先在设置中绑定伙伴' }, { status: 403 })

  const body = await req.json()
  const { payer, items, total_amount, my_share, source_text, note, date } = body

  if (!payer || !items || !total_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Insert bill
  const { data: bill, error: billError } = await supabase
    .from('aa_bills')
    .insert([{
      couple_id: profile.couple_id,
      payer,
      status: 'pending',
      total_amount,
      my_share,
      source_text: source_text ?? '',
      note: note ?? null,
      date: date ?? new Date().toISOString().split('T')[0],
    }])
    .select()
    .single()

  if (billError) return NextResponse.json({ error: billError.message }, { status: 500 })

  // Insert items
  const itemRows = items.map((item: { name: string; amount: number }) => ({
    bill_id: bill.id,
    name: item.name,
    amount: item.amount,
  }))

  const { error: itemsError } = await supabase.from('aa_items').insert(itemRows)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  return NextResponse.json({ data: bill })
}

// PATCH: update bill status (settle)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, status } = body

  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })

  const { data, error } = await supabase
    .from('aa_bills')
    .update({ status })
    .eq('id', id)
    .eq('couple_id', profile.couple_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE: remove bill (cascades to items via FK)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase.from('aa_bills').delete().eq('id', id).eq('couple_id', profile.couple_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
