import { AIAgent } from './src/lib/agents/agent'
import { AgentContext } from './src/lib/agents/registry'
import * as fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf-8')
for (const line of envFile.split('\n')) {
  if (line.startsWith('DEEPSEEK_API_KEY=')) {
    process.env.DEEPSEEK_API_KEY = line.split('=')[1].trim()
  }
}

async function runFailureTest() {
  console.log('--- Starting Simulated Failure Test ---')

  const mockSupabase = {
    from: (table: string) => ({
      insert: async (data: any) => {
        // Extract the draft display payload
        const item = data[0]
        const payload = item.payload
        console.log(`[Mock Supabase] Inserting into ${table}: "${payload.title}"`)

        // Simulate database constraint violation if title contains '汉堡王' or '汉堡'
        if (payload.title && (payload.title.includes('汉堡王') || payload.title.includes('汉堡'))) {
          console.warn(`[Mock Supabase] SIMULATING ERROR for: "${payload.title}"`)
          return {
            data: null,
            error: {
              code: '23514',
              message: 'new row violates check constraint "aa_drafts_record_type_check"'
            }
          }
        }
        return { data: null, error: null }
      }
    })
  }

  const context: AgentContext = {
    userId: 'user-123',
    coupleId: 'couple-456',
    identity: 'me',
    displayName: '宝宝大人',
    partnerName: '小可爱',
    supabase: mockSupabase as any
  }

  const agent = new AIAgent(context)

  // Give a smaller prompt to keep testing fast and focused
  const userInput = `我们去山东玩：
6月20号汉堡王早餐我买的汉堡，花了13块7。
然后打车去租车，他付的车费22块。
中午吃海鲜90块也是他给的。`

  const chatMessages = [
    { role: 'user' as const, content: userInput }
  ]

  const result = await agent.run(chatMessages, (step) => {
    if (step.type === 'status') {
      console.log(`[StepStatus] ${step.status}: ${step.message} ${step.tool ? `(tool: ${step.tool})` : ''}`)
    }
  })

  console.log('\n--- Test Completed ---')
  console.log('AI Final Reply:', result.text)
  console.log('Successfully recorded drafts:', JSON.stringify(result.records || [], null, 2))
}

runFailureTest().catch(console.error)
