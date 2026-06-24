import { z } from 'zod'
import { Skill, ToolDefinition } from '../registry'

/**
 * Helper function to calculate dbMyShare (amount to be paid by the male partner 'me' in the database).
 * This abstracts and decouples the split calculations from raw ternary operations.
 *
 * @param splitType - The type of splitting ('average' | 'payer_all' | 'partner_all' | 'custom')
 * @param total - Total amount of the transaction
 * @param aiMyShare - Amount the speaker ('me' in AI perspective) should pay, parsed from AI
 * @param dbPayer - Transformed database payer ('me' | 'her')
 * @param identity - Identity of the current speaker ('me' | 'her')
 */
export function calculateDbMyShare(params: {
  splitType: 'average' | 'payer_all' | 'partner_all' | 'custom';
  total: number;
  aiMyShare: number;
  dbPayer: 'me' | 'her';
  identity: 'me' | 'her';
}): number {
  const { splitType, total, aiMyShare, dbPayer, identity } = params;

  switch (splitType) {
    case 'average':
      return total / 2;

    case 'payer_all':
      // The payer pays 100%, partner pays 0%
      return dbPayer === 'me' ? total : 0;

    case 'partner_all':
      // The payer's partner pays 100%, payer pays 0%
      return dbPayer === 'me' ? 0 : total;

    case 'custom':
    default:
      // Fallback to speaker-centric logic
      return identity === 'her' ? (total - aiMyShare) : aiMyShare;
  }
}

export const addRecordTool: ToolDefinition<{
  type: 'gift' | 'aa' | 'borrow' | 'personal';
  payer?: 'me' | 'her';
  from?: 'me' | 'her';
  to?: 'me' | 'her';
  split_type?: 'average' | 'payer_all' | 'partner_all' | 'custom' | 'personal';
  title: string;
  amount: number | null;
  my_share?: number | null;
  category?: string | null;
  description?: string | null;
  date?: string | null;
  source_text: string;
  event_title?: string;
}> = {
  name: 'add_record',
  description: '生成一条记账草稿以供用户核对确认，并返回草稿卡片（is_draft: true）。该操作并没有直接存入数据库，请引导用户核对草稿并一键确认。如果是礼物填写 from/to，如果是账单填写 payer/split_type。如果用户记录的是一组属于同一场景的开销（如“威海游”、“装修”），请提炼一个简短的 event_title，并确保该组所有账单都填入相同的 event_title。如果只是零散的日常开销，请留空。',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['gift', 'aa', 'borrow', 'personal'], description: '记录类型' },
      payer: { type: 'string', enum: ['me', 'her'], description: '付款人 (仅 aa/borrow/personal 需要)' },
      from: { type: 'string', enum: ['me', 'her'], description: '送礼人 (仅 gift 需要)' },
      to: { type: 'string', enum: ['me', 'her'], description: '收礼人 (仅 gift 需要)' },
      split_type: { type: 'string', enum: ['average', 'payer_all', 'partner_all', 'custom', 'personal'], description: '分摊方式' },
      title: { type: 'string', description: '简短的账单标题，例如“打车”、“晚饭”' },
      amount: { type: 'number', description: '总金额' },
      my_share: { type: 'number', description: '说话人应承担的金额，根据 split_type 规则计算' },
      category: { type: 'string', description: '分类，如餐饮、交通等' },
      description: { type: 'string', description: '备注信息' },
      date: { type: 'string', description: '日期 YYYY-MM-DD' },
      source_text: { type: 'string', description: '用户原始的自然语言语句，便于后续关联' },
      event_title: { type: 'string', description: '场景事件名称（如“威海游”、“五一旅游”、“婚房装修”）。如果只是日常零散开销，请绝对不要填写此字段，留空即可！' }
    },
    required: ['type', 'title', 'source_text']
  },
  execute: async (context, args) => {
    const { userId, coupleId, identity, supabase } = context
    const imageUrls = context.image_urls || []

    try {
      const tempId = `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      
      const resolveIdentity = (val?: string) => {
        if (!val) return 'me'
        if (identity !== 'her') return val
        if (val === 'me') return 'her'
        if (val === 'her') return 'me'
        return val
      }

      let draftDisplayPayload: any;
      const recordType = args.type

      if (recordType === 'gift') {
        draftDisplayPayload = {
          id: tempId,
          record_type: 'gift',
          is_draft: true,
          from_user: resolveIdentity(args.from),
          to_user: resolveIdentity(args.to),
          title: args.title || '礼物',
          amount: args.amount,
          description: args.description || null,
          category: args.category || null,
          source_text: args.source_text,
          event_title: args.event_title || null,
          image_urls: imageUrls,
          date: args.date || new Date().toISOString().split('T')[0],
        }
      } else {
        const dbPayer = resolveIdentity(args.payer) as 'me' | 'her'
        const safeTotal = args.amount || 0
        let dbMyShare = 0;

        if (recordType === 'personal' || args.split_type === 'personal') {
           dbMyShare = dbPayer === 'me' ? safeTotal : 0;
        } else if (recordType === 'borrow') {
           dbMyShare = dbPayer === 'me' ? 0 : safeTotal;
        } else {
           dbMyShare = calculateDbMyShare({
             splitType: (args.split_type || 'average') as 'average' | 'payer_all' | 'partner_all' | 'custom',
             total: safeTotal,
             aiMyShare: args.my_share || 0,
             dbPayer,
             identity: identity as 'me' | 'her'
           })
        }

        draftDisplayPayload = {
          id: tempId,
          record_type: recordType,
          is_draft: true,
          payer: dbPayer,
          status: 'pending',
          total_amount: safeTotal,
          my_share: dbMyShare,
          source_text: args.source_text,
          event_title: args.event_title || null,
          image_urls: imageUrls,
          note: args.description || null,
          title: args.title || '支出记录',
          aa_items: [{ id: `draft-item-${tempId}-0`, name: args.title || '支出项', amount: safeTotal, category: args.category || null }],
          date: args.date || new Date().toISOString().split('T')[0],
        }
      }

      const draftToInsert = {
        id: tempId,
        couple_id: coupleId,
        creator_id: userId,
        record_type: recordType,
        payload: draftDisplayPayload,
        created_at: new Date().toISOString()
      }

      if (!supabase) throw new Error('Supabase client not found in context');
      const { error: insertError } = await supabase.from('aa_drafts').insert([draftToInsert]);
      if (insertError) {
        console.error('Failed to save draft:', insertError);
        throw new Error('草稿保存失败');
      }

      return {
        success: true,
        count: 1,
        records: [{ draft_id: tempId, ...draftDisplayPayload }]
      }
    } catch (err: any) {
      console.error('[Agent Tool: add_record] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const settleBillsTool: ToolDefinition<{ bill_ids: string[] }> = {
  name: 'settle_bills',
  description: '把指定的多个 AA 账单在数据库中标记为已结清（settled）状态。',
  parameters: {
    type: 'object',
    properties: {
      bill_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '需要结清的账单 UUID 列表'
      }
    },
    required: ['bill_ids']
  },
  execute: async (context, args) => {
    const { supabase, coupleId } = context
    try {
      const { data, error } = await supabase
        .from('aa_bills')
        .update({ status: 'settled' })
        .in('id', args.bill_ids)
        .eq('couple_id', coupleId)
        .select('id, note, total_amount, my_share, payer')

      if (error) throw error

      return {
        success: true,
        count: data?.length || 0,
        settled_bills: data
      }
    } catch (err: any) {
      console.error('[Agent Tool: settle_bills] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const BillingSkill: Skill = {
  name: 'BillingSkill',
  description: '日常账目和礼物的增删改查、结账等事务性技能',
  tools: [addRecordTool, settleBillsTool]
}
