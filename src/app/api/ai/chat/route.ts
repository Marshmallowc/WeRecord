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

    // Filter and reconstruct messages to match DeepSeek expected structure with proper tool calling history
    const cleanedMessages = messages.flatMap((m: any) => {
      const role = m.role || (m.sender === 'user' ? 'user' : 'assistant')
      const content = m.text || m.content || ''

      if (role === 'assistant' && m.records && m.records.length > 0) {
        const callId = `call_${Math.random().toString(36).substring(2, 11)}`
        
        // Reconstruct add_record arguments mapping DB state back to tool arguments
        const argsRecords = m.records.map((r: any) => {
          const recordType = r.record_type || 'aa'
          const isGift = recordType === 'gift'
          
          const resolveToolIdentity = (dbVal?: string) => {
            if (!dbVal) return undefined
            if (context.identity === 'her') {
              if (dbVal === 'me') return 'her'
              if (dbVal === 'her') return 'me'
            }
            return dbVal
          }

          return {
            reasoning: r.reasoning || `Reconstructed from draft: ${r.title}`,
            type: recordType,
            payer: isGift ? undefined : resolveToolIdentity(r.payer),
            from: isGift ? resolveToolIdentity(r.from_user) : undefined,
            to: isGift ? resolveToolIdentity(r.to_user) : undefined,
            title: r.title || '账单',
            amount: r.amount ?? r.total_amount ?? 0,
            my_share: r.my_share ?? null,
            category: r.category || (r.aa_items?.[0]?.category) || null,
            description: r.description || r.note || null,
            date: r.date || null,
            source_text: r.source_text || r.title || '',
            event_title: r.event_title || null
          }
        })

        return [
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: callId,
                type: 'function',
                function: {
                  name: 'add_record',
                  arguments: JSON.stringify({ records: argsRecords })
                }
              }
            ]
          },
          {
            role: 'tool',
            tool_call_id: callId,
            name: 'add_record',
            content: JSON.stringify({
              success: true,
              count: m.records.length,
              records: m.records
            })
          },
          {
            role: 'assistant',
            content: content
          }
        ]
      }

      return [
        {
          role,
          content
        }
      ]
    })

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
        let isClosed = false

        const sendStep = (step: any) => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`))
          } catch (e) {
            isClosed = true
            console.error('[API Chat Route] Failed to enqueue chunk, stream might be closed:', e)
          }
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
          if (!isClosed) {
            isClosed = true
            try {
              controller.close()
            } catch (e) {
              console.error('[API Chat Route] Failed to close stream:', e)
            }
          }
        }
      },
      cancel() {
        console.log('[API Chat Route] Stream canceled by client')
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
