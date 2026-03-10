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

    // 1. Delete old one if exists for this identity (Simpler filter)
    // We filter by user_identity to avoid complex JSONB path issues in .delete()
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_identity', identity);

    if (deleteError) {
      console.error('Push sync: Delete error:', deleteError);
      return NextResponse.json({
        error: deleteError.message || 'Database error during deletion',
        code: deleteError.code
      }, { status: 500 });
    }

    // 2. Insert new one
    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      user_identity: identity,
      subscription: typeof subscription === 'string' ? JSON.parse(subscription) : subscription
    })

    if (insertError) {
      console.error('Push sync: Insert error:', insertError);
      return NextResponse.json({
        error: insertError.message || 'Database error during insertion',
        code: insertError.code
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Push sync: unexpected error:', err);
    return NextResponse.json({
      error: err.message || 'Unexpected server error',
      details: err.toString()
    }, { status: 500 })
  }
}
