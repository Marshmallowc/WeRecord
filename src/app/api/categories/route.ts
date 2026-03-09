import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: list all categories
export async function GET() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST: upsert category by name (returns existing or creates new)
export async function POST(req: NextRequest) {
  const { name, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  // Check if exists
  const { data: existing } = await supabase
    .from('categories')
    .select('*')
    .eq('name', name)
    .single()

  if (existing) return NextResponse.json({ data: existing, created: false })

  // Create new
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, color: color ?? categoryColor(name) }])
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
