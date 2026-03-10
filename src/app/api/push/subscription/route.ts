import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { identity, subscription } = await req.json()
    if (!identity || !subscription) {
      return NextResponse.json({ error: 'Missing identity or subscription' }, { status: 400 })
    }

    const endpoint = subscription.endpoint;
    if (!endpoint) {
      return NextResponse.json({ error: 'Invalid subscription: missing endpoint' }, { status: 400 })
    }

    // 1. Delete old one if exists for this endpoint
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('subscription->>endpoint', endpoint);

    if (deleteError) {
      console.error('Push sync: Delete error:', deleteError);
      // We continue anyway, or return error? Let's continue or return based on severity.
      // Usually, if the table is missing, this will fail.
      return NextResponse.json({ error: deleteError.message, details: deleteError }, { status: 500 });
    }

    // 2. Insert new one
    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      user_identity: identity,
      subscription
    })

    if (insertError) {
      console.error('Push sync: Insert error:', insertError);
      return NextResponse.json({ error: insertError.message, details: insertError }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Push sync: unexpected error:', err);
    return NextResponse.json({
      error: err.message || 'Unexpected server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
