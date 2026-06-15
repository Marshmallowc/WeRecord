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
  const { id, ids, type, ...updates } = body

  if ((!id && !ids) || !type) return NextResponse.json({ error: 'Missing id or type' }, { status: 400 })

  if (type === 'gift') {
    const { error } = await supabase.from('gifts').update({
      title: updates.title,
      amount: updates.amount,
      category: updates.category,
      date: updates.date,
      description: updates.description,
      from_user: updates.from_user,
    }).eq('id', id).eq('couple_id', profile.couple_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Support batch update for AA bills (mainly for 'settled' status)
    const targetIds = ids || [id]
    
    // 关键修复：只更新请求中提供的字段，避免 undefined 覆盖数据库已有数据
    const updateData: any = {}
    const fields = ['status', 'note', 'date', 'payer', 'total_amount', 'my_share']
    fields.forEach(f => {
      if (updates[f] !== undefined) updateData[f] = updates[f]
    })

    const { error } = await supabase.from('aa_bills')
      .update(updateData)
      .in('id', targetIds)
      .eq('couple_id', profile.couple_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
