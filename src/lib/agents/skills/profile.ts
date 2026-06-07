import { Skill, ToolDefinition } from '../registry'

export const getCoupleProfileTool: ToolDefinition = {
  name: 'get_couple_profile',
  description: '获取当前用户与情侣伙伴的基本身份资料（包括展示名，以及谁是\'me\'、谁是\'her\'等信息）。在需要称呼对方或确认个人身份映射时优先调用该工具。',
  execute: async (context) => {
    try {
      return {
        success: true,
        my_identity: context.identity,
        my_name: context.displayName,
        partner_name: context.partnerName,
        couple_id: context.coupleId
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

export const ProfileSkill: Skill = {
  name: 'ProfileSkill',
  description: '获取和管理情侣身份与资料的技能',
  tools: [getCoupleProfileTool]
}
