import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { identity, items: rawItems } = body
  const items = Array.isArray(rawItems) ? rawItems : (body.items ? body.items : (Array.isArray(body) ? body : [body]))
  const savedResults = []

  for (const entry of items) {
    const { type, result, source_text } = entry
    if (!type || !result) continue

    if (type === 'gift') {
      const { from, to, title, amount, description, date, category } = result
      if (category) {
        await fetch(`${new URL(req.url).origin}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: category })
        })
      }
      const { data, error } = await supabase.from('gifts').insert([{
        from_user: from,
        to_user: to,
        title,
        amount: amount ?? null,
        description: description ?? null,
        category: category ?? null,
        source_text,
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()
      if (!error) savedResults.push({ data, type: 'gift' })
    } else if (type === 'aa') {
      const { payer, items: aaItems, total, my_share, note, date } = result
      const categories = Array.from(new Set(((aaItems || []) as any[]).map(i => i.category).filter(Boolean)))
      await Promise.all(categories.map(cat =>
        fetch(`${new URL(req.url).origin}/api/categories`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cat })
        })
      ))

      const { data: bill, error: billError } = await supabase.from('aa_bills').insert([{
        payer, status: 'pending',
        total_amount: total,
        // If identity is 'her', the 'my_share' from AI is her share. 
        // We need to save the complement (me's share) to DB.
        my_share: identity === 'her' ? (total - my_share) : my_share,
        source_text,
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
