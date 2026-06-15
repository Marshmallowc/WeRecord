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

  // Fetch all pending AA bills for the couple
  const { data: bills, error } = await supabase
    .from('aa_bills')
    .select('id, payer, status, total_amount, my_share, bill_type, source_text, note, image_urls, date, created_at, aa_items(id, name, amount, category)')
    .eq('couple_id', coupleId)
    .eq('status', 'pending')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const billItems = (bills ?? []).map((b: any) => ({ ...b, record_type: b.bill_type || 'aa' }))

  return NextResponse.json({ data: billItems })
}
