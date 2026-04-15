import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 获取用户的 couple_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('couple_id')
    .eq('id', user.id)
    .single()

  const coupleId = profile?.couple_id
  if (!coupleId) {
    return NextResponse.json({ error: '请先在设置中绑定伙伴' }, { status: 403 })
  }

  const body = await req.json()
  const { identity, items: rawItems } = body
  const items = Array.isArray(rawItems) ? rawItems : (body.items ? body.items : (Array.isArray(body) ? body : [body]))
  const savedResults = []

  for (const entry of items) {
    const { type, result, source_text } = entry
    if (!type || !result) continue

    // Helper to map speaker-centric identities ('me' meaning speaker) to DB identities
    const resolve = (val: string) => {
      if (identity !== 'her') return val // Already 'me'
      if (val === 'me') return 'her'
      if (val === 'her') return 'me'
      return val
    }

    if (type === 'gift') {
      const { from, to, title, amount, description, date, category, image_urls } = result
      if (category) {
        await supabase.from('categories').upsert({ 
          name: category, 
          couple_id: coupleId 
        }, { onConflict: 'couple_id, name' })
      }
      const { data, error } = await supabase.from('gifts').insert([{
        couple_id: coupleId,
        creator_id: user.id,
        from_user: resolve(from || 'me'),
        to_user: resolve(to || 'her'),
        title,
        amount: amount ?? null,
        description: description ?? null,
        category: category ?? null,
        source_text,
        image_urls: image_urls ?? [],
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()
      if (!error) savedResults.push({ data, type: 'gift' })
    } else if (type === 'aa') {
      const { payer, items: aaItems, total, my_share, note, date, image_urls } = result
      const categories = Array.from(new Set(((aaItems || []) as any[]).map(i => i.category).filter(Boolean)))

      if (categories.length > 0) {
        await supabase.from('categories').upsert(
          categories.map(cat => ({ name: cat, couple_id: coupleId })), 
          { onConflict: 'couple_id, name' }
        )
      }

      const { data: bill, error: billError } = await supabase.from('aa_bills').insert([{
        couple_id: coupleId,
        creator_id: user.id,
        payer: resolve(payer || 'me'),
        status: 'pending',
        total_amount: total,
        // If speaker is 'her', AI's my_share is her responsibility. 
        // We save the 'me' (boy) responsibility to the DB.
        my_share: identity === 'her' ? (total - my_share) : my_share,
        source_text,
        image_urls: image_urls ?? [],
        // 核心优化：将 AI 总结的标题存入 note 头部，方便 SmartTitle 组件解析
        note: (result.title ? `${result.title} | ${note || ''}` : note) ?? null,
        date: date ?? new Date().toISOString().split('T')[0],
      }]).select().single()

      if (!billError && bill) {
        // 核心修复：处理 AI 可能漏掉的明细金额，及确保有明细数据用于前端展示标题
        const finalItems = (Array.isArray(aaItems) && aaItems.length > 0) 
          ? aaItems 
          : [{ name: '生活杂项', amount: total }];

        const itemRows = finalItems.map(item => ({
          bill_id: bill.id,
          name: item.name || '支出项',
          // 容错逻辑：如果明细没有金额，优先用总额填充（单项时），或补 0（多项时）以避开数据库 NOT NULL 约束
          amount: (typeof item.amount === 'number') ? item.amount : (finalItems.length === 1 ? (total || 0) : 0),
          category: item.category ?? null,
        }))

        const { error: itemsError } = await supabase.from('aa_items').insert(itemRows)
        
        if (itemsError) {
          console.error('[Save API] aa_items 插入失败:', itemsError)
        }
        
        savedResults.push({ data: bill, type: 'aa' })
      } else if (billError) {
        console.error('[Save API] aa_bills 插入失败:', billError)
      }
    }
  }

  return NextResponse.json({ success: true, count: savedResults.length, results: savedResults })
}
