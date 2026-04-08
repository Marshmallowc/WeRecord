import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { id, display_name, avatar_url, alipay_code } = body

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id,
      display_name,
      avatar_url,
      alipay_code,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
