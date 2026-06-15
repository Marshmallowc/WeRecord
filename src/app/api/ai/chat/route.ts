import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AIAgent } from '@/lib/agents/agent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch current user's profile details
    const { data: myProfile, error: myProfileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (myProfileErr || !myProfile) {
      return NextResponse.json({ error: 'Failed to retrieve user profile' }, { status: 500 })
    }

    const coupleId = myProfile.couple_id
    if (!coupleId) {
      return NextResponse.json({ error: '请先在设置中绑定您的情侣伙伴，以激活AI财务管家功能。' }, { status: 403 })
    }

    // 3. Fetch partner's profile to resolve names
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('couple_id', coupleId)
      .neq('id', user.id)
      .maybeSingle()

    const partnerName = partnerProfile?.display_name || (myProfile.identity === 'me' ? '对方' : 'Ta')

    // 4. Retrieve message thread
    const { messages, image_urls, stream: shouldStream = true } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing conversation history' }, { status: 400 })
    }

    // Filter messages to match DeepSeek expected structure
    const cleanedMessages = messages.map((m: any) => {
      const role = m.role || (m.sender === 'user' ? 'user' : 'assistant')
      let content = m.text || m.content || ''
      if (role === 'assistant' && m.records && m.records.length > 0) {
        content += `\n\n[已生成的草稿数据: ${JSON.stringify(m.records)}]`
      }
      return {
        role,
        content
      }
    })

    // 5. Build Agent execution context
    const context = {
      supabase,
      userId: user.id,
      coupleId: coupleId,
      identity: myProfile.identity as 'me' | 'her',
      displayName: myProfile.display_name || '用户',
      partnerName: partnerName,
      image_urls: image_urls || []
    }

    // 5.5 If client requests non-streaming, execute agent synchronously and return JSON
    if (!shouldStream) {
      try {
        const agent = new AIAgent(context)
        const result = await agent.run(cleanedMessages)
        return NextResponse.json({ type: 'final', text: result.text, records: result.records })
      } catch (err: any) {
        console.error('[API Chat Route Non-Streaming] Agent run failed:', err)
        return NextResponse.json({ error: err.message || 'AI Assistant run failed' }, { status: 500 })
      }
    }

    // 6. Run AIAgent in streaming mode
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendStep = (step: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`))
        }

        try {
          const agent = new AIAgent(context)
          const result = await agent.run(cleanedMessages, (step) => {
            sendStep(step)
          })
          sendStep({ type: 'final', text: result.text, records: result.records })
        } catch (err: any) {
          console.error('[API Chat Route Streaming] Agent run failed:', err)
          sendStep({ type: 'error', error: err.message || 'AI Assistant run failed' })
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    })
  } catch (err: any) {
    console.error('[API Chat Route] Initialization failed:', err)
    return NextResponse.json({ error: err.message || 'AI Assistant service initialization failure' }, { status: 500 })
  }
}
