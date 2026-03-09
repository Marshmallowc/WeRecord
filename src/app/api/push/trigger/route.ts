import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  // Configure web-push with VAPID keys inside the handler to avoid build-time errors
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('VAPID keys are not set in environment variables')
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(
    'mailto:support@werecord.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const { targetIdentity, title, body, url } = await req.json()

  if (!targetIdentity) {
    return NextResponse.json({ error: 'Missing targetIdentity' }, { status: 400 })
  }

  // Get all subscriptions for the target user
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_identity', targetIdentity)

  if (error || !subs || subs.length === 0) {
    console.log('No subscriptions found for', targetIdentity)
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

  // Clean up failed subscriptions (e.g., expired/uninstalled)
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === 'rejected') {
      const error = res.reason as any;
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription has expired or is no longer valid
        const expiredSub = subs[i].subscription as any;
        await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', expiredSub.endpoint);
        console.log('Deleted expired subscription:', expiredSub.endpoint);
      }
    }
  }

  return NextResponse.json({ success: true, count: results.length })
}
