import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRuleViolation } from '../../validate/route'

export const dynamic = 'force-dynamic'

// POST /api/configurator/rules/test
// Tests a rule against a sample configuration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ruleId, ruleDefinition, config } = body

    if (!config) {
      return NextResponse.json({ error: 'config is required' }, { status: 400 })
    }

    let rule = ruleDefinition

    if (ruleId && !rule) {
      const { data, error } = await supabaseAdmin
        .from('cfg_rules')
        .select('*')
        .eq('id', ruleId)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
      rule = data
    }

    if (!rule) {
      return NextResponse.json({ error: 'ruleId or ruleDefinition is required' }, { status: 400 })
    }

    const result = checkRuleViolation(config, rule)

    return NextResponse.json({
      triggered: result !== null,
      violation: result
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
