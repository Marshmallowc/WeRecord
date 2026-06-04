import * as tools from './tools'
import { AgentContext } from './tools'

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
4. 语言解析：如果用户提到“我”，表示 ${myName}；如果提到“Ta”或“${partnerName}”，表示伴侣。

工具调用说明：
- 在开始回答用户关于具体账目是否记过、金额多少等问题前，请务必先调用 query_records 工具进行检索。
- 如果你要帮用户记账，请使用 add_record 工具。注意：当你调用 add_record 工具时，它只会生成一条“记账草稿”卡片呈现给用户确认，并没有存库。你绝对不能声称“已经记入账本”或“已成功入账”！你应该回复引导用户核对下方的草稿卡片内容，并提示他们点击卡片上的“确认记入账本”按钮来完成保存。
- If you need to search relative dates (like 'yesterday', 'day before yesterday'), calculate the YYYY-MM-DD string relative to the current date (${todayDate}) and pass it to query_records.
- 如果你要结账平账，请使用 settle_bills 工具。
- 如果用户要求提醒对方平账，请使用 notify_partner 工具。`

const TOOL_SCHEMAS = [
  {
    "type": "function",
    "function": {
      "name": "get_couple_profile",
      "description": "获取当前用户与情侣伙伴的基本身份资料（包括展示名，以及谁是'me'、谁是'her'等信息）。在需要称呼对方或确认个人身份映射时优先调用该工具。"
    }
  },
  {
    "type": "function",
    "function": {
      "name": "query_records",
      "description": "在账本中精准查找 AA 账单或礼物记录。可基于分类、关键字、时间段或结账状态进行过滤。该工具会返回匹配的详细记录 JSON 列表。",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "用于模糊匹配账单或礼物标题的关键字（如 '电影', '咖啡'）" },
          "record_type": { "type": "string", "enum": ["aa", "gift"], "description": "要筛选的记录类型：'aa' (支出) 或 'gift' (礼物)。不传则查全部。" },
          "start_date": { "type": "string", "description": "查询的起始日期，格式 YYYY-MM-DD（如 '2026-05-01'）" },
          "end_date": { "type": "string", "description": "查询的结束日期，格式 YYYY-MM-DD" },
          "status": { "type": "string", "enum": ["pending", "settled"], "description": "仅针对AA账单进行过滤：'pending' (未平账/待结清) 或 'settled' (已平账/已结清)。" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_record",
      "description": "生成一条记账草稿以供用户核对确认，并返回草稿卡片（is_draft: true）。该操作并没有直接存入数据库，请引导用户核对下方的草稿卡片信息并点击“确认记入账本”以完成正式入库。",
      "parameters": {
        "type": "object",
        "properties": {
          "text": { "type": "string", "description": "用户的自然语言账务记录语句" }
        },
        "required": ["text"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "settle_bills",
      "description": "把指定的多个 AA 账单在数据库中标记为已结清（settled）状态。",
      "parameters": {
        "type": "object",
        "properties": {
          "bill_ids": {
            "type": "array",
            "items": { "type": "string" },
            "description": "需要结清的账单 UUID 列表"
          }
        },
        "required": ["bill_ids"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "notify_partner",
      "description": "给情侣伙伴发送一条 Web Push 手机推送提醒。可以用于催促对方平账，或发送重要财务提示。",
      "parameters": {
        "type": "object",
        "properties": {
          "body": { "type": "string", "description": "推送通知的内容文本（例如：'亲爱的，昨天有一笔 45 元的账单待结清哦'，禁止包含 Emoji）" }
        },
        "required": ["body"]
      }
    }
  }
]

export class AIAgent {
  private context: AgentContext

  constructor(context: AgentContext) {
    this.context = context
  }

  async run(chatMessages: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; name?: string; tool_call_id?: string }[]) {
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
    const maxIterations = 5

    while (iterations < maxIterations) {
      iterations++
      console.log(`[AIAgent] Running iteration ${iterations}...`)

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesToSend,
          tools: TOOL_SCHEMAS,
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
      // Note: We need to push the tool_calls property if it exists
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
        return {
          text: message.content || '',
          records: collectedRecords.length > 0 ? collectedRecords : undefined
        }
      }

      // Execute tool calls
      console.log(`[AIAgent] DeepSeek requested ${message.tool_calls.length} tool call(s)`)
      for (const toolCall of message.tool_calls) {
        const { name, arguments: rawArgs } = toolCall.function
        const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs
        console.log(`[AIAgent] Executing tool: ${name} with args:`, parsedArgs)

        let toolResult: any = null

        // Dispatch based on tool name
        switch (name) {
          case 'get_couple_profile':
            toolResult = await tools.get_couple_profile(this.context)
            break
          case 'query_records':
            toolResult = await tools.query_records(this.context, parsedArgs)
            if (toolResult.success && Array.isArray(toolResult.records)) {
              collectedRecords = [...collectedRecords, ...toolResult.records]
            }
            break
          case 'add_record':
            toolResult = await tools.add_record(this.context, parsedArgs)
            if (toolResult.success && Array.isArray(toolResult.records)) {
              collectedRecords = [...collectedRecords, ...toolResult.records]
            }
            break
          case 'settle_bills':
            toolResult = await tools.settle_bills(this.context, parsedArgs)
            if (toolResult.success && Array.isArray(toolResult.settled_bills)) {
              // Add settled records so they are refreshed in UI
              collectedRecords = [...collectedRecords, ...toolResult.settled_bills]
            }
            break
          case 'notify_partner':
            toolResult = await tools.notify_partner(this.context, parsedArgs)
            break
          default:
            toolResult = { success: false, error: `Unknown tool name: ${name}` }
        }

        console.log(`[AIAgent] Tool result for ${name}:`, toolResult)

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
  }
}
