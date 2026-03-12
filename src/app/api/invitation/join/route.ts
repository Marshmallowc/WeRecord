import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { code } = await req.json()

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  // 调用我们在数据库里写的存储过程
  const { data: coupleId, error } = await supabase.rpc('accept_invitation', {
    invite_code: code.toUpperCase()
  })

  if (error) {
    console.error('Join RPC Error:', error)
    // 捕获 SQL 里抛出的异常
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, couple_id: coupleId })
}
