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
      const { from, to, title, amount, description, date, category, image_urls } = result
      if (category) {
        // Direct database insert instead of internal fetch
        await supabase.from('categories').upsert({ name: category }, { onConflict: 'name' })
      }
      const { data, error } = await supabase.from('gifts').insert([{
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

      // Direct database insert for all categories
      if (categories.length > 0) {
        await supabase.from('categories').upsert(categories.map(cat => ({ name: cat })), { onConflict: 'name' })
      }

      const { data: bill, error: billError } = await supabase.from('aa_bills').insert([{
        payer, status: 'pending',
        total_amount: total,
        // If identity is 'her', the 'my_share' from AI is her share. 
        // We need to save the complement (me's share) to DB.
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
