import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 获取用户的 couple_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('couple_id')
      .eq('id', user.id)
      .single()

    if (!profile?.couple_id) {
      return NextResponse.json({ error: 'Please bind a partner first' }, { status: 403 })
    }

    const { identity, subscription } = await req.json()

    if (!identity || !subscription) {
      return NextResponse.json({ error: 'Missing identity or subscription data' }, { status: 400 })
    }

    const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    const endpoint = subObj.endpoint;

    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // 1. Delete old subscriptions for this user on this identity/couple to keep it clean
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_identity', identity)
      .eq('couple_id', profile.couple_id);

    // 2. Insert new one
    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      user_identity: identity,
      couple_id: profile.couple_id,
      subscription: subObj
    })

    if (insertError) throw insertError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Push sync error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
