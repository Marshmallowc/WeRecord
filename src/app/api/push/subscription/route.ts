import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { identity, subscription } = await req.json()
  if (!identity || !subscription) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  // Delete old one if exists for this endpoint
  const endpoint = subscription.endpoint;
  await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', endpoint);

  // Insert new one
  const { error } = await supabase.from('push_subscriptions').insert({
    user_identity: identity,
    subscription
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
