import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  const coupleId = profile?.couple_id

  if (!coupleId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (await params).id;
  const body = await req.json()
  const { cover_url, title } = body

  const updateData: any = {}
  if (cover_url !== undefined) updateData.cover_url = cover_url
  if (title !== undefined) updateData.title = title

  const { data, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', id)
    .eq('couple_id', coupleId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (await params).id;

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('couple_id', profile.couple_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
