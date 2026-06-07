import { SupabaseClient } from '@supabase/supabase-js'

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
  parameters?: any // JSON Schema parameter block
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
    return this.getTools().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        ...(t.parameters ? { parameters: t.parameters } : {})
      }
    }))
  }

  async executeTool(name: string, context: AgentContext, args: any): Promise<any> {
    const tool = this.getTools().find(t => t.name === name)
    if (!tool) {
      return { success: false, error: `Tool ${name} not found in registry.` }
    }
    try {
      return await tool.execute(context, args)
    } catch (err: any) {
      console.error(`[AgentSkillRegistry] Error executing tool ${name}:`, err)
      return { success: false, error: err.message || `Failed to execute tool ${name}` }
    }
  }
}
