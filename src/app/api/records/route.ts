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

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const fetchLimit = page * limit
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')
  const payer = searchParams.get('payer')
  const type = searchParams.get('type') // 'gift' or 'aa'
  const includeInsights = searchParams.get('include_insights') === 'true'

  let giftQuery = supabase.from('gifts').select('id, creator_id, from_user, to_user, title, amount, description, category, source_text, image_urls, date, created_at')
    .eq('couple_id', coupleId)
  let billQuery = supabase.from('aa_bills').select('id, creator_id, payer, status, total_amount, my_share, bill_type, source_text, note, image_urls, date, created_at, aa_items(id, name, amount, category)')
    .eq('couple_id', coupleId)
  let insightQuery = supabase.from('ai_insights').select('id, content, insight_type, date, created_at')
    .eq('couple_id', coupleId)

  // Apply filters
  if (search) {
    giftQuery = giftQuery.ilike('title', `%${search}%`)
    billQuery = billQuery.ilike('source_text', `%${search}%`)
  }
  if (category) {
    giftQuery = giftQuery.eq('category', category)
  }
  if (payer) {
    giftQuery = giftQuery.eq('from_user', payer)
    billQuery = billQuery.eq('payer', payer)
  }

  const queries: any[] = [
    giftQuery.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(fetchLimit),
    billQuery.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(fetchLimit),
  ]

  // Only include insights if explicitly requested or if type is 'insight'
  const shouldIncludeInsights = includeInsights || type === 'insight'
  if (shouldIncludeInsights) {
    queries.push(insightQuery.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(fetchLimit))
  }

  const results = await Promise.all(queries)
  const giftsRes = results[0] as any
  const billsRes = results[1] as any
  const insightsRes = shouldIncludeInsights ? results[2] as any : { data: [] }

  const giftItems = (giftsRes.data ?? []).map((g: any) => ({ ...g, record_type: 'gift' }))
  let billItems = (billsRes.data ?? []).map((b: any) => ({ ...b, record_type: b.bill_type || 'aa' }))
  const insightItems = (insightsRes.data ?? []).map((i: any) => ({ ...i, record_type: 'insight' }))

  if (category) {
    billItems = billItems.filter((b: any) => b.aa_items?.some((i: any) => i.category === category))
  }

  let combined = [...giftItems, ...billItems, ...insightItems]

  if (type) {
    combined = combined.filter(r => r.record_type === type)
  }

  combined = combined.sort((a: any, b: any) => {
    const d1 = new Date(a.date).getTime()
    const d2 = new Date(b.date).getTime()
    if (d1 !== d2) return d2 - d1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const offset = (page - 1) * limit
  const paginatedData = combined.slice(offset, offset + limit)
  const hasMore = combined.length > offset + limit

  return NextResponse.json({ data: paginatedData, hasMore })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ids, type, old_type, new_type, ...updates } = body

  if ((!id && !ids) || !type) return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })

  const currentType = old_type || type
  const targetType = new_type || type

  // Check if type conversion between tables is needed
  if (id && currentType !== targetType && (
    (currentType === 'gift' && (targetType === 'aa' || targetType === 'borrow')) ||
    ((currentType === 'aa' || currentType === 'borrow') && targetType === 'gift')
  )) {
    if (currentType === 'gift' && (targetType === 'aa' || targetType === 'borrow')) {
      // 1. Fetch from gifts
      const { data: gift, error: getErr } = await supabase
        .from('gifts')
        .select('*')
        .eq('id', id)
        .eq('couple_id', profile.couple_id)
        .single()
      
      if (getErr || !gift) {
        return NextResponse.json({ error: 'Gift record not found' }, { status: 404 })
      }

      // 2. Delete from gifts
      const { error: delErr } = await supabase
        .from('gifts')
        .delete()
        .eq('id', id)
        .eq('couple_id', profile.couple_id)
      
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }

      // 3. Insert into aa_bills
      const payer = updates.payer || gift.from_user
      const totalAmount = updates.total_amount !== undefined ? updates.total_amount : gift.amount
      const myShare = updates.my_share !== undefined ? updates.my_share : (payer === 'me' ? totalAmount / 2 : totalAmount / 2)

      const { error: insErr } = await supabase
        .from('aa_bills')
        .insert({
          id: gift.id,
          couple_id: gift.couple_id,
          creator_id: gift.creator_id,
          payer: payer,
          status: updates.status || 'pending',
          total_amount: totalAmount,
          my_share: myShare,
          bill_type: targetType,
          source_text: gift.source_text,
          note: gift.title + (gift.description ? ` | ${gift.description}` : ''),
          date: updates.date || gift.date,
          image_urls: gift.image_urls,
          created_at: gift.created_at
        })
      
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    } else {
      // 1. Fetch from aa_bills
      const { data: bill, error: getErr } = await supabase
        .from('aa_bills')
        .select('*')
        .eq('id', id)
        .eq('couple_id', profile.couple_id)
        .single()
      
      if (getErr || !bill) {
        return NextResponse.json({ error: 'Bill record not found' }, { status: 404 })
      }

      // 2. Delete from aa_bills (cascades to aa_items)
      const { error: delErr } = await supabase
        .from('aa_bills')
        .delete()
        .eq('id', id)
        .eq('couple_id', profile.couple_id)
      
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }

      // 3. Insert into gifts
      const payer = updates.payer || bill.payer
      const amount = updates.amount !== undefined ? updates.amount : (updates.total_amount !== undefined ? updates.total_amount : bill.total_amount)

      const { error: insErr } = await supabase
        .from('gifts')
        .insert({
          id: bill.id,
          couple_id: bill.couple_id,
          creator_id: bill.creator_id,
          from_user: payer,
          to_user: payer === 'me' ? 'her' : 'me',
          title: bill.note?.split('|')[0]?.trim() || bill.source_text || '礼物',
          amount: amount,
          description: bill.note?.split('|')[1]?.trim() || '',
          category: '礼物',
          source_text: bill.source_text,
          date: updates.date || bill.date,
          image_urls: bill.image_urls,
          created_at: bill.created_at
        })
      
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }
  } else {
    // Standard update (no cross-table conversion, but can be aa <-> borrow update)
    if (targetType === 'gift') {
      const { error } = await supabase.from('gifts').update({
        title: updates.title,
        amount: updates.amount !== undefined ? updates.amount : updates.total_amount,
        category: updates.category,
        date: updates.date,
        description: updates.description,
        from_user: updates.payer || updates.from_user,
        to_user: (updates.payer || updates.from_user) === 'me' ? 'her' : 'me',
      }).eq('id', id).eq('couple_id', profile.couple_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const targetIds = ids || [id]
      
      const updateData: any = {}
      const fields = ['status', 'note', 'date', 'payer', 'total_amount', 'my_share', 'bill_type']
      fields.forEach(f => {
        if (updates[f] !== undefined) updateData[f] = updates[f]
      })

      // Ensure bill_type is explicitly set if targetType is 'aa' or 'borrow'
      if (id && (targetType === 'aa' || targetType === 'borrow')) {
        updateData.bill_type = targetType
      }

      const { error } = await supabase.from('aa_bills')
        .update(updateData)
        .in('id', targetIds)
        .eq('couple_id', profile.couple_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type')

  if (!id || !type) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  if (type === 'gift') {
    await supabase.from('gifts').delete().eq('id', id).eq('couple_id', profile.couple_id)
  } else if (type === 'insight') {
    await supabase.from('ai_insights').delete().eq('id', id).eq('couple_id', profile.couple_id)
  } else {
    await supabase.from('aa_bills').delete().eq('id', id).eq('couple_id', profile.couple_id)
  }
  return NextResponse.json({ success: true })
}
