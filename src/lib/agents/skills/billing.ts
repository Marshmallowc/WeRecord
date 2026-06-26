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

export const addRecordSchema = z.object({
  records: z.array(
    z.object({
      reasoning: z.string()
        .describe('思维链推理过程。写出谁付款的、分摊方式、谁请客、是否垫付、我(me)和对方应该如何分摊，逻辑上是如何计算得出最终数字的。请在最开始输出'),
      type: z.enum(['gift', 'aa', 'borrow', 'personal'])
        .describe('记录类型：gift 为礼物，aa 为两人 AA 分摊，borrow 为代付/借款，personal 为个人自费账单'),
      payer: z.enum(['me', 'her'])
        .optional()
        .describe('付款人，指代谁付的这笔账 (仅 aa/borrow/personal 类型需要，例如：\'me\' 表示自己付的，\'her\' 表示对方付的)'),
      from: z.enum(['me', 'her'])
        .optional()
        .describe('送礼人 (仅 gift 类型需要，例如：\'me\' 表示自己送对方，\'her\' 表示对方送自己)'),
      to: z.enum(['me', 'her'])
        .optional()
        .describe('收礼人 (仅 gift 类型需要，例如：\'me\' 表示自己收到礼，\'her\' 表示对方收到礼)'),
      split_type: z.enum(['average', 'payer_all', 'partner_all', 'custom', 'personal'])
        .optional()
        .describe('分摊方式：average 为 AA 平均分摊，payer_all 为付款人全额承担，partner_all 为对方全额承担，custom 为自定义比例分摊，personal 为个人完全自费(仅用于 personal 类型)'),
      title: z.string()
        .min(1)
        .describe('简短的账单标题，例如“打车”、“晚饭”'),
      amount: z.number()
        .nullable()
        .optional()
        .describe('总金额（元），如果是 AA/礼物等必须是正数'),
      my_share: z.number()
        .nullable()
        .optional()
        .describe('说话人（我）应承担的金额。注意：仅在分摊方式 split_type 为 custom 时，才根据用户陈述计算并必填，其他分摊方式下大模型请勿填写，由系统自动计算'),
      category: z.string()
        .nullable()
        .optional()
        .describe('分类，如餐饮、交通、购物、娱乐等'),
      description: z.string()
        .nullable()
        .optional()
        .describe('备注信息'),
      date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '日期必须是 YYYY-MM-DD 格式' })
        .nullable()
        .optional()
        .describe('交易发生的日期，格式为 YYYY-MM-DD'),
      source_text: z.string()
        .describe('用户原始的自然语言描述句子，用于追溯数据来源'),
      event_title: z.string()
        .nullable()
        .optional()
        .describe('场景事件名称（如“威海游”、“五一旅游”、“婚房装修”）。如果是一次性或日常零散开销，请绝对不要填写此字段，留空即可！')
    })
  ).describe('需要批量生成的账单/礼物/草稿对象数组')
})

export const addRecordTool: ToolDefinition<z.infer<typeof addRecordSchema>> = {
  name: 'add_record',
  description: '生成一条或多条记账草稿以供用户核对确认，并返回草稿卡片（is_draft: true）。该操作并没有直接存入数据库，请引导用户核对草稿并一键确认。如果是礼物填写 from/to，如果是账单填写 payer/split_type。如果用户记录的是一组属于同一场景的开销（如“威海游”、“装修”），请提炼一个简短的 event_title，并确保该组所有账单都填入相同的 event_title。如果只是零散的日常开销，请留空。支持一次性生成多条记录。',
  zodSchema: addRecordSchema,
  execute: async (context, args) => {
    const { userId, coupleId, identity, supabase } = context
    const imageUrls = context.image_urls || []

    try {
      if (!supabase) throw new Error('Supabase client not found in context');

      const results: any[] = []
      const failedRecords: any[] = []
      
      const insertPromises = args.records.map(async (record, i) => {
        const tempId = `draft-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        
        const resolveIdentity = (val?: string) => {
          if (!val) return 'me'
          if (identity !== 'her') return val
          if (val === 'me') return 'her'
          if (val === 'her') return 'me'
          return val
        }

        let draftDisplayPayload: any;
        const rawType = record.type
        // Map personal to aa to bypass database constraints
        const recordType = rawType === 'personal' ? 'aa' : rawType

        if (recordType === 'gift') {
          draftDisplayPayload = {
            id: tempId,
            record_type: 'gift',
            is_draft: true,
            reasoning: record.reasoning || null,
            from_user: resolveIdentity(record.from),
            to_user: resolveIdentity(record.to),
            title: record.title || '礼物',
            amount: record.amount,
            description: record.description || null,
            category: record.category || null,
            source_text: record.source_text,
            event_title: record.event_title || null,
            image_urls: imageUrls,
            date: record.date || new Date().toISOString().split('T')[0],
          }
        } else {
          const dbPayer = resolveIdentity(record.payer) as 'me' | 'her'
          const safeTotal = record.amount || 0
          let dbMyShare = 0;

          if (rawType === 'personal' || record.split_type === 'personal') {
             dbMyShare = dbPayer === 'me' ? safeTotal : 0;
          } else if (recordType === 'borrow') {
             dbMyShare = dbPayer === 'me' ? 0 : safeTotal;
          } else {
             dbMyShare = calculateDbMyShare({
               splitType: (record.split_type || 'average') as 'average' | 'payer_all' | 'partner_all' | 'custom',
               total: safeTotal,
               aiMyShare: record.my_share || 0,
               dbPayer,
               identity: identity as 'me' | 'her'
             })
          }

          draftDisplayPayload = {
            id: tempId,
            record_type: recordType,
            is_draft: true,
            reasoning: record.reasoning || null,
            payer: dbPayer,
            status: 'pending',
            total_amount: safeTotal,
            my_share: dbMyShare,
            source_text: record.source_text,
            event_title: record.event_title || null,
            image_urls: imageUrls,
            note: record.description || null,
            title: record.title || '支出记录',
            aa_items: [{ id: `draft-item-${tempId}-0`, name: record.title || '支出项', amount: safeTotal, category: record.category || null }],
            date: record.date || new Date().toISOString().split('T')[0],
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

        const { error: insertError } = await supabase.from('aa_drafts').insert([draftToInsert]);
        if (insertError) {
          console.error('Failed to save draft:', insertError);
          throw new Error(`数据库插入失败: ${insertError.message || JSON.stringify(insertError)}`);
        }

        return { draft_id: tempId, ...draftDisplayPayload }
      });

      const settled = await Promise.allSettled(insertPromises);
      settled.forEach((result, i) => {
        const record = args.records[i]
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.error(`[Agent Tool: add_record] Record at index ${i} ("${record.title}") failed:`, result.reason)
          failedRecords.push({
            index: i,
            title: record.title,
            amount: record.amount,
            error: result.reason.message || '未知保存失败'
          })
        }
      });

      if (failedRecords.length > 0) {
        // Partial success response format
        return {
          success: false,
          error: `批量保存出现部分失败。在 ${args.records.length} 笔账单中，成功 ${results.length} 笔，失败 ${failedRecords.length} 笔。注意：成功的卡片已正常入库（请绝对不要重新录入这部分，以免产生重复脏数据）。请仔细分析错误原因，并【仅针对】这 ${failedRecords.length} 笔失败的账单重新调用 add_record。失败详情: ${JSON.stringify(failedRecords)}`,
          records: results,
          success_count: results.length,
          failed_count: failedRecords.length
        }
      }

      return {
        success: true,
        count: results.length,
        records: results
      }
    } catch (err: any) {
      console.error('[Agent Tool: add_record] Global error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const settleBillsSchema = z.object({
  bill_ids: z.array(z.string().uuid()).describe('需要结清的账单 UUID 列表')
})

export const settleBillsTool: ToolDefinition<z.infer<typeof settleBillsSchema>> = {
  name: 'settle_bills',
  description: '把指定的多个 AA 账单在数据库中标记为已结清（settled）状态。',
  zodSchema: settleBillsSchema,
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
