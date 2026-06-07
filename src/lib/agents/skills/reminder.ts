import { Skill, ToolDefinition } from '../registry'
import webpush from 'web-push'

export const notifyPartnerTool: ToolDefinition<{ body: string }> = {
  name: 'notify_partner',
  description: '给情侣伙伴发送一条 Web Push 手机推送提醒。可以用于催促对方平账，或发送重要财务提示。',
  parameters: {
    type: 'object',
    properties: {
      body: { type: 'string', description: '推送通知的内容文本（例如：\'亲爱的，昨天有一笔 45 元的账单待结清哦\'，禁止包含 Emoji）' }
    },
    required: ['body']
  },
  execute: async (context, args) => {
    const { supabase, coupleId, identity } = context
    try {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        throw new Error('Push notifications VAPID keys not configured in server environment')
      }

      webpush.setVapidDetails(
        'mailto:support@werecord.app',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )

      // The partner is the opposite of my identity
      const partnerIdentity = identity === 'me' ? 'her' : 'me'

      // Retrieve partner subscriptions
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_identity', partnerIdentity)
        .eq('couple_id', coupleId)

      if (error) throw error
      if (!subs || subs.length === 0) {
        return { success: false, count: 0, message: 'Partner does not have any active push notification subscriptions' }
      }

      const payload = JSON.stringify({
        title: '💸 WeRecord 财务管家提醒',
        body: args.body,
        url: '/'
      })

      const results = await Promise.allSettled(
        subs.map(row => webpush.sendNotification(row.subscription as any, payload))
      )

      // Clean up failed subscriptions
      for (let i = 0; i < results.length; i++) {
        const res = results[i]
        if (res.status === 'rejected') {
          const errorDetail = res.reason as any
          if (errorDetail.statusCode === 410 || errorDetail.statusCode === 404) {
            const expiredSub = subs[i].subscription as any
            await supabase.from('push_subscriptions').delete().eq('subscription->>endpoint', expiredSub.endpoint)
          }
        }
      }

      const successCount = results.filter(r => r.status === 'fulfilled').length

      return {
        success: true,
        count: successCount,
        total_attempted: results.length
      }
    } catch (err: any) {
      console.error('[Agent Tool: notify_partner] Error:', err)
      return { success: false, error: err.message }
    }
  }
}

export const ReminderSkill: Skill = {
  name: 'ReminderSkill',
  description: '给情侣伙伴推送通知或催款等提醒技能',
  tools: [notifyPartnerTool]
}
