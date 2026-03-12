import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 生成 6 位大写随机码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除容易混淆的 0, O, 1, I
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. 检查是否已有未过期的邀请码
  const { data: existing } = await supabase
    .from('invitations')
    .select('code, expires_at')
    .eq('inviter_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existing) {
    return NextResponse.json({ code: existing.code, expires_at: existing.expires_at })
  }

  // 2. 生成新码
  const newCode = generateInviteCode()
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      code: newCode,
      inviter_id: user.id
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ code: data.code, expires_at: data.expires_at })
}
