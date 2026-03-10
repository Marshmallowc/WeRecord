import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Pre-check environment variables to avoid runtime crashes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing on server');
      return NextResponse.json({ error: 'Supabase configuration missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { identity, subscription } = body;

    if (!identity || !subscription) {
      return NextResponse.json({ error: 'Missing identity or subscription data' }, { status: 400 });
    }

    // Handle both object and stringified subscription
    const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    const endpoint = subObj.endpoint;

    if (!endpoint) {
      return NextResponse.json({
        error: 'Invalid subscription: missing endpoint',
        received: subObj
      }, { status: 400 });
    }

    // 1. Delete old one if exists for this identity (Simple filter)
    // This avoids duplicated subscriptions for the same user identity
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_identity', identity);

    if (deleteError) {
      console.error('Push sync: Delete error:', deleteError);
      // Even if deletion fails, we return a clear error
      return NextResponse.json({
        error: deleteError.message || 'Database error during deletion',
        code: deleteError.code
      }, { status: 500 });
    }

    // 2. Insert new one
    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      user_identity: identity,
      subscription: subObj
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
      details: err.toString(),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 })
  }
}
