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
  const savedResults = []

  for (const entry of items) {
    const { type, result, source_text } = entry
    if (!type || !result) continue

    if (type === 'gift') {
      const { from, to, title, amount, description, date, category, image_urls } = result
      if (category) {
        await supabase.from('categories').upsert({ 
          name: category, 
          couple_id: coupleId 
        }, { onConflict: 'couple_id, name' })
      }
      const { data, error } = await supabase.from('gifts').insert([{
        couple_id: coupleId,
        creator_id: user.id,
        from_user: from,
        to_user: to,
        title,
        amount: amount ?? null,
        description: description ?? null,
        category: category ?? null,
        source_text,
        image_urls: image_urls ?? [],
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()
      if (!error) savedResults.push({ data, type: 'gift' })
    } else if (type === 'aa') {
      const { payer, items: aaItems, total, my_share, note, date, image_urls } = result
      const categories = Array.from(new Set(((aaItems || []) as any[]).map(i => i.category).filter(Boolean)))

      if (categories.length > 0) {
        await supabase.from('categories').upsert(
          categories.map(cat => ({ name: cat, couple_id: coupleId })), 
          { onConflict: 'couple_id, name' }
        )
      }

      const { data: bill, error: billError } = await supabase.from('aa_bills').insert([{
        couple_id: coupleId,
        creator_id: user.id,
        payer, status: 'pending',
        total_amount: total,
        my_share: identity === 'her' ? (total - my_share) : my_share,
        source_text,
        image_urls: image_urls ?? [],
        note: note ?? null, date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()

      if (!billError) {
        const itemRows = (aaItems as any[]).map(item => ({
          bill_id: bill.id, name: item.name, amount: item.amount,
          category: item.category ?? null,
        }))
        await supabase.from('aa_items').insert(itemRows)
        savedResults.push({ data: bill, type: 'aa' })
      }
    }
  }

  return NextResponse.json({ success: true, count: savedResults.length, results: savedResults })
}
