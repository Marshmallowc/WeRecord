import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: list all categories for this couple + global defaults
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id

  let query = supabase.from('categories').select('*')
  
  if (coupleId) {
    query = query.or(`couple_id.is.null,couple_id.eq.${coupleId}`)
  } else {
    query = query.is('couple_id', null)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST: upsert category by name for this couple
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: '请先绑定伙伴' }, { status: 403 })

  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  // Upsert for this couple
  const { data, error } = await supabase
    .from('categories')
    .upsert({ 
      name, 
      couple_id: profile.couple_id,
      color: color ?? categoryColor(name) 
    }, { onConflict: 'couple_id, name' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, created: true })
}

// Auto assign color based on category name
function categoryColor(name: string): string {
  const map: Record<string, string> = {
    '餐饮': '#f97316',
    '日用品': '#6fcf97',
    '数码': '#7db8f7',
    '护肤': '#f472b6',
    '服装': '#a78bfa',
    '交通': '#fbbf24',
    '娱乐': '#34d399',
    '医疗': '#f87171',
    '礼物': '#e8956d',
    '超市': '#6fcf97',
    '外卖': '#f97316',
  }
  for (const [key, color] of Object.entries(map)) {
    if (name.includes(key)) return color
  }
  // Hash-based fallback
  const colors = ['#e8956d', '#7db8f7', '#6fcf97', '#f97316', '#a78bfa', '#fbbf24', '#f472b6']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length
  return colors[Math.abs(hash)]
}
