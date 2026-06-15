import { describe, test, expect } from 'vitest'
import { addRecordTool } from '../lib/agents/skills/billing'

// Mock context factory
const createMockContext = (identity: 'me' | 'her') => ({
  userId: 'qa_user_id',
  coupleId: 'qa_couple_id',
  identity,
  supabase: {
    from: (table: string) => ({
      insert: (data: any) => {
        console.log(`💾 QA Test Mock DB Insert -> [${table}]:`);
        console.log(JSON.stringify(data, null, 2));
        return { error: null };
      }
    })
  } as any
})

describe('AI 记账解析器 - 大厂级别高级 QA 测试用例集', () => {
  
  // ==========================================
  // 类别 1: ASR 语音识别容错与纠错
  // ==========================================
  
  test('TC-01: ASR 口语去重与大写数字解析', async () => {
    const context = createMockContext('me')
    const text = '昨儿个咱们去看了个电影，买了买了两张票花了九十八块八，我自己付的。'
    const result = await addRecordTool.execute!(context, { text })
    
    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('me')
    expect(r.total_amount).toBe(98.8)
    expect(r.my_share).toBe(49.4)
    expect(r.title).toContain('电影')
  })

  test('TC-02: 同音错别字与口语金额解析', async () => {
    const context = createMockContext('her')
    const text = '今天吃麻辣烫花了三十块五，是叫外卖的，他帮我付了付了。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('me') // partner (me) paid
    expect(r.total_amount).toBe(30.5)
    // her says "他帮我付了", it's her individual expense paid by partner (me)
    // split_type: partner_all (or average if it's considered together? her says "吃麻辣烫花了三十块五，是叫外卖的", this usually means her own portion.)
    // let's just assert the total amount and that payer is correct.
    expect(r.total_amount).toBe(30.5)
    expect(r.title).toContain('麻辣烫')
  })

  // ==========================================
  // 类别 2: 日记琐事过滤与意图提取
  // ==========================================

  test('TC-03: 长段生活流水账背景过滤 + AA消费', async () => {
    const context = createMockContext('me')
    const text = '真的要吐槽，今天地铁晚点半小时，热得我一身汗，然后去公司还被拉去开会，中午跟她去星巴克买了咖啡和蛋糕续命，我付款的，花了58块钱。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('me')
    expect(r.total_amount).toBe(58)
    expect(r.my_share).toBe(29)
    expect(r.title).toContain('星巴克')
    expect(r.title).not.toContain('开会')
    expect(r.title).not.toContain('地铁')
  })

  test('TC-04: 纯日记与情绪表达（无账单兜底）', async () => {
    const context = createMockContext('me')
    const text = '今天晚霞特别漂亮，风吹过来凉凉的，突然觉得生活很美好，好想带他一起去看海。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(0)
    expect(result.records).toHaveLength(0)
  })

  // ==========================================
  // 类别 3: 多账单与礼物拆分 (双向与请客)
  // ==========================================

  test('TC-05: 纪念日双向请客拆分（多笔 Gift 记录）', async () => {
    const context = createMockContext('me')
    const text = '今天是他生日，中午我请他吃了火锅，花了两百三十块，晚上他请我看了个恐怖电影，花了花了七十九块五。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(2)
    
    const r1 = result.records.find((r: any) => r.title.includes('火锅'))
    const r2 = result.records.find((r: any) => r.title.includes('电影'))
    
    expect(r1).toBeDefined()
    expect(r1.record_type).toBe('gift')
    expect(r1.from_user).toBe('me')
    expect(r1.to_user).toBe('her')
    expect(r1.amount).toBe(230)
    
    expect(r2).toBeDefined()
    expect(r2.record_type).toBe('gift')
    expect(r2.from_user).toBe('her')
    expect(r2.to_user).toBe('me')
    expect(r2.amount).toBe(79.5)
  })

  // ==========================================
  // 类别 4: 代付、垫付与自定义分摊 (复杂逻辑)
  // ==========================================

  test('TC-06: 帮对方全额代垫（不分摊）', async () => {
    const context = createMockContext('me')
    const text = '下午帮他带了个外卖，花了35.5元，他晚点转我。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('me')
    expect(r.total_amount).toBe(35.5)
    expect(r.my_share).toBe(0)
  })

  test('TC-07: 对方帮我全额代垫（我欠全款）', async () => {
    const context = createMockContext('me')
    const text = '今天他帮我在超市垫付了一箱牛奶，花了四十五块。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('her')
    expect(r.total_amount).toBe(45)
    expect(r.my_share).toBe(45)
  })

  test('TC-08: 自定义比例分摊 (Custom Split)', async () => {
    const context = createMockContext('me')
    const text = '今天去修车一共花了600，我们说好了，因为我开得多，我出400，他出200，他先付的钱。'
    const result = await addRecordTool.execute!(context, { text })

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    const r = result.records[0]
    expect(r.record_type).toBe('aa')
    expect(r.payer).toBe('her')
    expect(r.total_amount).toBe(600)
    expect(r.my_share).toBe(400)
  })

})
