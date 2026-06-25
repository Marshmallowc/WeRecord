import { AgentContext, AgentSkillRegistry } from './registry'
import { ProfileSkill } from './skills/profile'
import { BillingSkill } from './skills/billing'
import { ReminderSkill } from './skills/reminder'
import { AnalyticsSkill } from './skills/analytics'

const SYSTEM_PROMPT_TEMPLATE = (myIdentity: string, myName: string, partnerName: string, todayDate: string) => `你叫 Mason，是一个睿智、理性且充满温度、幽默风趣的情侣理财导师。
今天是：${todayDate} (星期几请根据日期自行换算，用于处理用户提到“今天、昨天、前天、本周、上周”等时间词)。
你现在正在与 ${myName} (身份标识是 '${myIdentity}') 聊天，Ta 的情侣伴侣是 ${partnerName}。

你的任务：
1. 辅助情侣管理他们的日常 AA 账目、分摊开支与送礼记录。
2. 回答关于“有无漏记、某笔账记了没有、花了多少钱、谁欠谁多少钱”等任何财务检索和计算的提问。
3. 协助执行日常操作：记账、平账结算、给对方发送提醒推送。

严格执行的约束条件：
1. 严禁 Emoji：你的所有最终文本回复中禁止出现任何 Emoji 表情符号，保持简洁、有温度且风趣幽默的语气。
2. 回复长度：控制在 150 - 250 字之间，用词精炼，直奔主题。
3. 数据安全与隐私：你只能使用分配给你的工具来查写数据。禁止透露内部 ID，只将卡片实体或摘要反馈给用户。
4. 语言解析：如果用户提到“我”或“我自己”，表示 ${myName}；如果提到“Ta”、“他”、“她”或“${partnerName}”，一律表示伴侣。

记账与账单提取核心规则 (Core Billing Rules)：
1. 身份映射 (Identity Mapping)：
   - 'me' 指代“当前说话人”（即发送文字的 ${myName}）。
   - 'her' 指代“伴侣”（即 ${partnerName}）。
   - 即使 ${myName} 是女生，在记账 JSON 的 from/to/payer 中也要用 'me' 指代自己，用 'her' 指代伴侣。
2. 批量处理 (Batch Processing - 极度重要)：
   - 当用户提供多笔账单流水（如一段长游记），**你必须使用单次 \`add_record\` 工具调用，并将所有提取出的账单以数组形式放入 \`records\` 属性中！** 绝不允许把它们拆分成多次独立的 \`add_record\` 工具调用，也绝不允许只录入一部分，更不能反问用户“是否继续录入”。一次性把它们全部提取出来。
3. 分摊方式 (split_type)：
   - 'average'：默认平摊。
   - 'payer_all'：付款人全额承担（如我请客我付钱）。
   - 'personal'：个人纯自费，不计入两人社交债务（比如“我自己买的洗面奶”）。
4. 借款/代付 (borrow) 或 礼物 (gift)：代买垫资用 borrow，特殊节日互送用 gift。
5. ASR 纠错与日记过滤：纠正语音转文字错误（如“花了花了14块”应为 14）。过滤掉心情日记，只提取账单。

工具调用说明：
- 在开始回答用户关于具体账目是否记过、金额多少等问题前，请务必先调用查询工具进行检索。
- 统计与总数陷阱（极端重要）：回答“有多少单”、“一共花了多少钱”、“我付了多少/对方付了多少”、“我多少笔/他多少笔”等统计问题时：
  - 只要涉及到区分“我付的”还是“对方付的”（如“我多少笔，他多少笔”），**必须分别调用两次 query_financial_data**（一次 payer: 'me'，一次 payer: 'her'），利用返回的 \`total_count\` 或 \`pending_count\` 聚合值来回答。
  - 如果是普通全部统计，可以调用 get_financial_stats 统计摘要。
  - 如果是包含特定筛选条件的复杂统计（如“**对方**有多少笔未结清”、“**我**昨天付了多少钱”），**必须调用 query_financial_data 工具**，传入对应的过滤条件（如 payer: 'her', status: 'pending' 等），读取返回的 \`pending_count\`、\`sum_aa_total\` 或 \`total_count\` 聚合字段直接回答。
  - **严禁**调用 query_records 试图查出明细列表后在内存里进行人工累加或数数！那会导致严重的财务算错漏算！
- 批量结清防漏陷阱：如果用户要求“平账所有的账单”，但查询返回了 \`has_more: true\`，你在调用 settle_bills 时只能处理当前返回的那些 ID。处理完后，你**必须**在最终回复中明确告知用户：“因为单次操作限制，我先为您结清了这 30 笔，还剩几笔未结清，请再吩咐我一次继续平账。”
- 如果你要帮用户记账，请使用 add_record 工具。注意：当你调用 add_record 工具时，它只会生成一条“记账草稿”卡片呈现给用户确认，并没有存库。你绝对不能声称“已经记入账本”或“已成功入账”！你应该回复引导用户核对下方的草稿卡片内容，并提示他们点击卡片上的“一键确认”按钮来完成保存。
- 补发图片场景：如果用户刚刚发了账单，现在又发来图片并说“把这个图片加上去”、“漏传图了”等，因为你无法直接修改或向旧草稿添加图片，你必须阅读你们的聊天记录，找出上一笔账务的具体文字描述（例如“昨天吃饭200元平摊”），然后重新调用 add_record 工具把那段文字再传一遍。系统底层的上下文会自动将用户最新上传的图片绑定到这次新生成的草稿上。
- If you need to search relative dates (like 'yesterday', 'day before yesterday'), calculate the YYYY-MM-DD string relative to the current date (${todayDate}) and pass it to tools.
- 如果你要结账平账，请使用 settle_bills 工具。
- 如果用户要求提醒对方平账，请使用 notify_partner 工具。`

export type AgentStep =
  | { type: 'status'; status: 'thinking' | 'calling_tool' | 'tool_complete' | 'responding'; message: string; tool?: string }
  | { type: 'final'; text: string; records?: any[] }
  | { type: 'error'; error: string }

export class AIAgent {
  private context: AgentContext
  private registry: AgentSkillRegistry

  constructor(context: AgentContext) {
    this.context = context
    this.registry = new AgentSkillRegistry()
    this.registry.register(ProfileSkill)
    this.registry.register(BillingSkill)
    this.registry.register(ReminderSkill)
    this.registry.register(AnalyticsSkill)
  }

  async run(
    chatMessages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; name?: string; tool_call_id?: string }[],
    onStep?: (step: AgentStep) => void
  ) {
    // 1. Prepare messages list for DeepSeek
    const todayDate = new Date().toISOString().split('T')[0] // Get today's local YYYY-MM-DD
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE(this.context.identity, this.context.displayName, this.context.partnerName, todayDate)
    
    // Start message list with the system prompt
    const messagesToSend: any[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages
    ]

    // We will collect any records queried/created during this session to send back as structured metadata
    let collectedRecords: any[] = []
    let iterations = 0
    const maxIterations = 15

    // Global heartbeat: Keep connection alive during BOTH LLM generation and tool execution.
    // This is the industry standard practice for long-running AI agents over SSE.
    const globalHeartbeat = setInterval(() => {
      onStep?.({ type: 'ping' } as any)
    }, 5000)

    try {
      while (iterations < maxIterations) {
        iterations++
        console.log(`[AIAgent] Running iteration ${iterations}...`)
        onStep?.({ type: 'status', status: 'thinking', message: '思考中' })

        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messagesToSend,
            tools: this.registry.getToolSchemas(),
            tool_choice: 'auto',
            temperature: 0.1,
          }),
        })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`DeepSeek API error: ${errText}`)
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message

      if (!message) {
        throw new Error('Empty response from DeepSeek API')
      }

      // Add model's intermediate/final message to context
      const modelMessage: any = {
        role: 'assistant',
        content: message.content || ''
      }
      if (message.tool_calls) {
        modelMessage.tool_calls = message.tool_calls
      }
      messagesToSend.push(modelMessage)

      // If the model does not want to make tool calls, we are finished
      if (!message.tool_calls || message.tool_calls.length === 0) {
        console.log(`[AIAgent] Loop finished. Returning final response: "${message.content}"`)
        onStep?.({ type: 'status', status: 'responding', message: '准备回复中' })
        return {
          text: message.content || '',
          records: collectedRecords.length > 0 ? collectedRecords : undefined
        }
      }

      // Execute tool calls
      console.log(`[AIAgent] DeepSeek requested ${message.tool_calls.length} tool call(s)`)
      
      const toolCallPromises = message.tool_calls.map(async (toolCall: any) => {
        const { name, arguments: rawArgs } = toolCall.function
        const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs
        console.log(`[AIAgent] Executing tool: ${name} with args:`, parsedArgs)

        const toolMessages: Record<string, { start: string; end: string }> = {
          get_couple_profile: { start: '读取情侣伙伴资料中', end: '资料读取完成' },
          query_records: { start: '检索账目记录中', end: '账目检索完成' },
          query_financial_data: { start: '进行高级财务分析中', end: '财务数据分析完毕' },
          add_record: { start: '起草记账卡片中', end: '记账草稿已生成' },
          settle_bills: { start: '办理结账手续中', end: '结账手续办理完毕' },
          notify_partner: { start: '向伙伴发送消息提醒中', end: '消息提醒发送成功' },
          get_financial_stats: { start: '汇总财务开支数据中', end: '财务数据汇总完毕' }
        }
        const msg = toolMessages[name] || { start: `运行工具 ${name} 中`, end: `工具 ${name} 运行完成` }
        onStep?.({ type: 'status', status: 'calling_tool', tool: name, message: msg.start })

        const toolResult = await this.registry.executeTool(name, this.context, parsedArgs)

        console.log(`[AIAgent] Tool result for ${name}:`, toolResult)
        onStep?.({ type: 'status', status: 'tool_complete', tool: name, message: msg.end })

        return { toolCall, toolResult, name }
      })

      // Wait for all tools in this batch to complete
      const toolResults = await Promise.all(toolCallPromises)

      // Collect records and append messages in the exact order
      for (const { toolCall, toolResult, name } of toolResults) {
        // Collect successfully processed records even on partial failures, so they can render on the client UI
        if (name === 'query_records' || name === 'query_financial_data' || name === 'add_record') {
          if (Array.isArray(toolResult.records)) {
            collectedRecords = [...collectedRecords, ...toolResult.records]
          }
        } else if (name === 'settle_bills' && Array.isArray(toolResult.settled_bills)) {
          collectedRecords = [...collectedRecords, ...toolResult.settled_bills]
        }

        // Append tool call result message
        messagesToSend.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify(toolResult)
        })
      }
    }

    // Fallback if max iterations exceeded
    const lastMsg = messagesToSend[messagesToSend.length - 1]
    return {
      text: lastMsg?.role === 'assistant' ? lastMsg.content : '对不起，我处理该请求耗费了太长时间，请换个简单的方式问我吧。',
      records: collectedRecords.length > 0 ? collectedRecords : undefined
    }
    } finally {
      clearInterval(globalHeartbeat)
    }
  }
}
