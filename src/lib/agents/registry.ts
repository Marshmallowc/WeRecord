import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export interface AgentContext {
  supabase: SupabaseClient
  userId: string
  coupleId: string
  identity: 'me' | 'her'
  displayName: string
  partnerName: string
  image_urls?: string[]
}

export interface ToolDefinition<T = any> {
  name: string
  description: string
  parameters?: any // Fallback JSON Schema parameter block
  zodSchema?: z.ZodSchema<T>
  execute: (context: AgentContext, args: T) => Promise<any>
}

export interface Skill {
  name: string
  description: string
  tools: ToolDefinition[]
}

export class AgentSkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill) {
    this.skills.set(skill.name, skill)
  }

  getTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = []
    for (const skill of this.skills.values()) {
      allTools.push(...skill.tools)
    }
    return allTools
  }

  getToolSchemas() {
    return this.getTools().map(t => {
      let parameters = t.parameters
      if (t.zodSchema) {
        let converted: any
        if (typeof (t.zodSchema as any).toJSONSchema === 'function') {
          converted = (t.zodSchema as any).toJSONSchema()
        } else {
          converted = zodToJsonSchema(t.zodSchema as any) as any
        }
        const { $schema, ...clean } = converted
        parameters = clean
      }
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          ...(parameters ? { parameters } : {})
        }
      }
    })
  }

  async executeTool(name: string, context: AgentContext, args: any): Promise<any> {
    const tool = this.getTools().find(t => t.name === name)
    if (!tool) {
      return { success: false, error: `Tool ${name} not found in registry.` }
    }
    try {
      if (tool.zodSchema) {
        const parsed = tool.zodSchema.safeParse(args)
        if (!parsed.success) {
          const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          return {
            success: false,
            error: `Zod validation failed for tool ${name} arguments: ${errors}`
          }
        }
        args = parsed.data
      }
      return await tool.execute(context, args)
    } catch (err: any) {
      console.error(`[AgentSkillRegistry] Error executing tool ${name}:`, err)
      return { success: false, error: err.message || `Failed to execute tool ${name}` }
    }
  }
}
