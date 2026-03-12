import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    'mailto:support@werecord.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('couple_id').eq('id', user.id).single()
  if (!profile?.couple_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetIdentity, title, body, url } = await req.json()

  if (!targetIdentity) {
    return NextResponse.json({ error: 'Missing targetIdentity' }, { status: 400 })
  }

  // Get all subscriptions for the target user IN THE SAME COUPLE
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_identity', targetIdentity)
    .eq('couple_id', profile.couple_id)

  if (error || !subs || subs.length === 0) {
    return NextResponse.json({ success: false, message: 'No active devices for notification' })
  }

  const results = await Promise.allSettled(
    subs.map(row => {
      const payload = JSON.stringify({
        title: title || 'WeRecord 提醒',
        body: body || '你有新的待办事项',
        url: url || '/'
      })
      return webpush.sendNotification(row.subscription as any, payload)
    })
  )

  // Clean up failed subscriptions
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === 'rejected') {
      const error = res.reason as any;
      if (error.statusCode === 410 || error.statusCode === 404) {
        const expiredSub = subs[i].subscription as any;
        await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', expiredSub.endpoint);
      }
    }
  }

  return NextResponse.json({ success: true, count: results.length })
}
