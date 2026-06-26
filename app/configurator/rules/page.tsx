'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle, Plus, Edit2, Trash2, X, Check, Save, ArrowLeft, RefreshCw, AlertOctagon, HelpCircle
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/app/components/Toast'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Condition = {
  field: string
  equals?: string
  not_equals?: string
  in?: string[]
  not_in?: string[]
}

type RuleConditions = {
  when: Condition
  then: Condition
}

type Rule = {
  id: string
  name: string
  description?: string
  rule_type: string
  category?: string
  conditions: RuleConditions
  action: 'disable' | 'require' | 'warn' | 'hide'
  action_message?: string
  priority: number
  is_active: boolean
  created_by?: string
  created_at?: string
}

const FIELD_OPTIONS = [
  { value: 'metal_type', label: 'Metal Type (gold, silver, platinum)' },
  { value: 'metal_id', label: 'Metal ID' },
  { value: 'karat', label: 'Metal Karat' },
  { value: 'finish_id', label: 'Finish ID' },
  { value: 'stone_type_id', label: 'Stone Type ID' },
  { value: 'shape_id', label: 'Stone Shape ID' },
  { value: 'size_id', label: 'Stone Size ID' },
  { value: 'setting_type', label: 'Setting Type' },
  { value: 'ring_size', label: 'Ring Size' },
  { value: 'band_width', label: 'Band Width' },
  { value: 'chain_type', label: 'Chain Type' },
  { value: 'chain_length', label: 'Chain Length' }
]

const RULE_TYPES = [
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'dimension', label: 'Dimension Constraint' },
  { value: 'category', label: 'Category Option' },
  { value: 'metal_karat', label: 'Metal / Karat Rule' },
  { value: 'stone_setting', label: 'Stone / Setting Rule' },
  { value: 'finish_metal', label: 'Finish / Metal Rule' }
]

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Modal states
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  
  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    rule_type: 'exclusion',
    category: '',
    action: 'disable' as 'disable' | 'require' | 'warn' | 'hide',
    action_message: '',
    priority: 100,
    is_active: true,
    whenField: 'shape_id',
    whenOperator: 'equals',
    whenValue: '',
    thenField: 'setting_type',
    thenOperator: 'not_in',
    thenValue: ''
  })

  // Testing sandbox state
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testingRuleId, setTestingRuleId] = useState<string>('')
  const [testConfigText, setTestConfigText] = useState(
    JSON.stringify({
      metal_type: 'gold',
      karat: 18,
      shape_id: 'princess-cut-id-here',
      setting_type: 'round_bezel'
    }, null, 2)
  )
  const [testResult, setTestResult] = useState<{ triggered: boolean; violation: any } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    setLoading(true)
    try {
      const res = await fetch('/api/configurator/rules')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (err: any) {
      toast('Failed to load rules: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function getConditionValues(cond: Condition) {
    if (cond.equals !== undefined) return { operator: 'equals', value: cond.equals }
    if (cond.not_equals !== undefined) return { operator: 'not_equals', value: cond.not_equals }
    if (cond.in !== undefined) return { operator: 'in', value: cond.in.join(', ') }
    if (cond.not_in !== undefined) return { operator: 'not_in', value: cond.not_in.join(', ') }
    return { operator: 'equals', value: '' }
  }

  function openAddRule() {
    setEditingRule(null)
    setRuleForm({
      name: '',
      description: '',
      rule_type: 'exclusion',
      category: '',
      action: 'disable',
      action_message: '',
      priority: 100,
      is_active: true,
      whenField: 'metal_type',
      whenOperator: 'equals',
      whenValue: 'silver',
      thenField: 'finish_id',
      thenOperator: 'not_in',
      thenValue: 'antique-finish-id-here'
    })
    setRuleModalOpen(true)
  }

  function openEditRule(rule: Rule) {
    setEditingRule(rule)
    const whenVals = getConditionValues(rule.conditions?.when || { field: 'metal_type' })
    const thenVals = getConditionValues(rule.conditions?.then || { field: 'finish_id' })

    setRuleForm({
      name: rule.name,
      description: rule.description || '',
      rule_type: rule.rule_type,
      category: rule.category || '',
      action: rule.action,
      action_message: rule.action_message || '',
      priority: rule.priority,
      is_active: rule.is_active,
      whenField: rule.conditions?.when?.field || 'metal_type',
      whenOperator: whenVals.operator,
      whenValue: whenVals.value,
      thenField: rule.conditions?.then?.field || 'finish_id',
      thenOperator: thenVals.operator,
      thenValue: thenVals.value
    })
    setRuleModalOpen(true)
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault()
    if (!ruleForm.name || !ruleForm.rule_type || !ruleForm.action) {
      toast('Required fields missing', 'error')
      return
    }

    // Build conditions object
    const buildConditionObj = (field: string, op: string, val: string): Condition => {
      const trimmedVal = val.trim()
      const list = trimmedVal.split(',').map(s => s.trim()).filter(Boolean)
      if (op === 'equals') return { field, equals: trimmedVal }
      if (op === 'not_equals') return { field, not_equals: trimmedVal }
      if (op === 'in') return { field, in: list }
      if (op === 'not_in') return { field, not_in: list }
      return { field, equals: trimmedVal }
    }

    const conditions: RuleConditions = {
      when: buildConditionObj(ruleForm.whenField, ruleForm.whenOperator, ruleForm.whenValue),
      then: buildConditionObj(ruleForm.thenField, ruleForm.thenOperator, ruleForm.thenValue)
    }

    const payload = {
      name: ruleForm.name,
      description: ruleForm.description,
      rule_type: ruleForm.rule_type,
      category: ruleForm.category || null,
      conditions,
      action: ruleForm.action,
      action_message: ruleForm.action_message,
      priority: ruleForm.priority,
      is_active: ruleForm.is_active
    }

    try {
      const method = editingRule ? 'PUT' : 'POST'
      const url = editingRule ? `/api/configurator/rules/${editingRule.id}` : '/api/configurator/rules'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save rule')

      toast(`Rule "${ruleForm.name}" saved`, 'success')
      setRuleModalOpen(false)
      loadRules()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function deleteRule(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete rule "${name}"?`)) return
    try {
      const res = await fetch(`/api/configurator/rules/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete rule')
      toast(`Rule "${name}" deleted`, 'success')
      loadRules()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  function openTestSandbox(ruleId: string) {
    setTestingRuleId(ruleId)
    setTestResult(null)
    setTestModalOpen(true)
  }

  async function runRuleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      let parsedConfig = {}
      try {
        parsedConfig = JSON.parse(testConfigText)
      } catch {
        toast('Invalid JSON structure in test config box', 'error')
        setTesting(false)
        return
      }

      const res = await fetch('/api/configurator/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: testingRuleId,
          config: parsedConfig
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')

      setTestResult(data)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setTesting(false)
    }
  }

  function renderConditionSummary(cond: Condition) {
    if (!cond) return '—'
    const values = getConditionValues(cond)
    let opLabel = ''
    if (values.operator === 'equals') opLabel = 'is'
    if (values.operator === 'not_equals') opLabel = 'is not'
    if (values.operator === 'in') opLabel = 'is one of'
    if (values.operator === 'not_in') opLabel = 'is not one of'

    return (
      <span className="text-stone-700 text-xs">
        <code className="bg-stone-100 text-[#1E3A5F] px-1 rounded font-bold font-mono">{cond.field}</code>{' '}
        <span className="text-stone-500 font-medium">{opLabel}</span>{' '}
        <code className="bg-stone-150 text-stone-850 px-1 rounded font-bold">{values.value}</code>
      </span>
    )
  }

  return (
    <div className="p-4 lg:p-7 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/configurator" className="text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Configuration Rules Engine</h1>
          <p className="text-stone-500 text-sm mt-0.5">Manage compatibility rules and exclusions</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-stone-500">
          Create rules to ensure configurations remain valid and order-ready (e.g. restrict bezel settings on square cuts).
        </p>
        <Button onClick={openAddRule} size="sm" className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading rules...
        </div>
      ) : rules.length === 0 ? (
        <div className="p-12 text-center text-stone-400 border border-dashed border-stone-250 rounded-2xl bg-white">
          <AlertOctagon className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="font-semibold text-stone-700">No compatibility rules defined</p>
          <p className="text-xs text-stone-500 mt-1">Configure your first validation rule using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => (
            <div key={rule.id} className={`bg-white rounded-xl border p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-sm transition-shadow ${
              rule.is_active ? 'border-stone-200' : 'border-stone-200 opacity-60 bg-stone-50/50'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-stone-900 truncate">{rule.name}</h3>
                  <span className="text-[10px] bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-md font-bold uppercase">
                    {rule.rule_type}
                  </span>
                  {rule.category && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase">
                      {rule.category}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                    rule.action === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    Action: {rule.action}
                  </span>
                  <span className="text-[10px] text-stone-400">Priority: {rule.priority}</span>
                </div>
                {rule.description && (
                  <p className="text-xs text-stone-500 mt-1 max-w-2xl">{rule.description}</p>
                )}
                
                {/* Visual conditions display */}
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 bg-stone-50 rounded-lg p-2.5 border border-stone-150">
                  <span className="text-[10px] uppercase font-bold text-stone-400 shrink-0">WHEN</span>
                  {renderConditionSummary(rule.conditions?.when)}
                  <span className="text-[10px] uppercase font-bold text-stone-400 shrink-0 sm:ml-4">THEN</span>
                  {renderConditionSummary(rule.conditions?.then)}
                </div>

                {rule.action_message && (
                  <p className="text-xs text-stone-450 mt-2 flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                    Message: <span className="italic">"{rule.action_message}"</span>
                  </p>
                )}
              </div>

              <div className="flex gap-1 shrink-0 self-end md:self-center">
                <Button variant="tertiary" size="sm" onClick={() => openTestSandbox(rule.id)}>
                  Test Rule
                </Button>
                <button onClick={() => openEditRule(rule)}
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteRule(rule.id, rule.name)}
                  className="p-2 text-red-400 hover:text-red-750 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      <Modal open={ruleModalOpen} onClose={() => setRuleModalOpen(false)} size="lg"
        title={editingRule ? `Edit Rule: ${editingRule.name}` : 'Create Configuration Rule'}>
        <form onSubmit={saveRule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Rule Name *</label>
              <Input value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Princess Cut Setting Restriction" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
              <Textarea value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Explain the logic of this rule for documentation" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Rule Type *</label>
              <Select value={ruleForm.rule_type} onChange={e => setRuleForm(p => ({ ...p, rule_type: e.target.value }))}>
                {RULE_TYPES.map(rt => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Applies to Category</label>
              <Select value={ruleForm.category} onChange={e => setRuleForm(p => ({ ...p, category: e.target.value }))}>
                <option value="">All Categories</option>
                <option value="ring">Rings</option>
                <option value="pendant">Pendants</option>
                <option value="earring">Earrings</option>
                <option value="bracelet">Bracelets</option>
                <option value="necklace">Necklaces</option>
                <option value="bangle">Bangles</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Action when violated *</label>
              <Select value={ruleForm.action} onChange={e => setRuleForm(p => ({ ...p, action: e.target.value as any }))}>
                <option value="disable">Disable Selection (Hard Block)</option>
                <option value="warn">Warn User (Warning indicator)</option>
                <option value="hide">Hide selection (Option invisible)</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Rule Priority</label>
              <Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(p => ({ ...p, priority: Number(e.target.value) }))} />
              <p className="text-[10px] text-stone-400 mt-1">Rules are evaluated highest priority first.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">User message when triggered</label>
              <Input value={ruleForm.action_message} onChange={e => setRuleForm(p => ({ ...p, action_message: e.target.value }))}
                placeholder="e.g. Bezel setting is not compatible with Princess Cut stones." />
            </div>
          </div>

          {/* Condition blocks */}
          <div className="border-t border-stone-150 pt-4 mt-2 space-y-4">
            <h4 className="font-semibold text-sm text-stone-850">Conditions Logic (When ➔ Then)</h4>
            <p className="text-[11px] text-stone-400 leading-normal">
              If the <span className="font-bold text-stone-600">WHEN</span> block condition evaluates to TRUE, then the configuration <span className="font-bold text-stone-600">MUST</span> satisfy the <span className="font-bold text-stone-600">THEN</span> condition. If it does not, a violation occurs and triggers the action.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WHEN */}
              <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">WHEN Selection</p>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Field</label>
                  <Select value={ruleForm.whenField} onChange={e => setRuleForm(p => ({ ...p, whenField: e.target.value }))}>
                    {FIELD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Operator</label>
                  <Select value={ruleForm.whenOperator} onChange={e => setRuleForm(p => ({ ...p, whenOperator: e.target.value }))}>
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                    <option value="in">is one of (comma-separated list)</option>
                    <option value="not_in">is not one of (comma-separated list)</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Value</label>
                  <Input value={ruleForm.whenValue} onChange={e => setRuleForm(p => ({ ...p, whenValue: e.target.value }))}
                    placeholder="e.g. princess, 18, gold" />
                </div>
              </div>

              {/* THEN */}
              <div className="bg-stone-50 p-4 border border-stone-200 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">THEN Requirement</p>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Field</label>
                  <Select value={ruleForm.thenField} onChange={e => setRuleForm(p => ({ ...p, thenField: e.target.value }))}>
                    {FIELD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Operator</label>
                  <Select value={ruleForm.thenOperator} onChange={e => setRuleForm(p => ({ ...p, thenOperator: e.target.value }))}>
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                    <option value="in">is one of (comma-separated list)</option>
                    <option value="not_in">is not one of (comma-separated list)</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-stone-500 mb-0.5">Value</label>
                  <Input value={ruleForm.thenValue} onChange={e => setRuleForm(p => ({ ...p, thenValue: e.target.value }))}
                    placeholder="e.g. prong, halo" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-stone-150 pt-4 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-[#1E3A5F]"
                checked={ruleForm.is_active} onChange={e => setRuleForm(p => ({ ...p, is_active: e.target.checked }))} />
              <span className="text-sm font-medium text-stone-700">Enable this rule</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="tertiary" onClick={() => setRuleModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Rule</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Rule Testing Sandbox Modal */}
      <Modal open={testModalOpen} onClose={() => setTestModalOpen(false)} title="Test Configuration Rule Sandbox">
        <div className="space-y-4">
          <p className="text-xs text-stone-400 leading-relaxed">
            Validate how this rule behaves by submitting a mock configuration. The system will evaluate the conditions and output the triggered status in real-time.
          </p>

          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">Mock Configuration (JSON)</label>
            <textarea
              value={testConfigText}
              onChange={e => setTestConfigText(e.target.value)}
              className="w-full font-mono text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 h-44 outline-none focus:bg-white focus:border-[#1E3A5F]"
            />
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
              testResult.triggered
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {testResult.triggered ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Rule Triggered! (Violation Detected)</p>
                    <p className="text-xs mt-1 text-rose-700">Action: <span className="font-mono uppercase font-bold">{testResult.violation?.action}</span></p>
                    <p className="text-xs text-rose-600 mt-0.5 italic">Message: "{testResult.violation?.message}"</p>
                  </div>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Rule Not Triggered (Passes validation)</p>
                    <p className="text-xs mt-1 text-green-700">The mock configuration satisfies this rule.</p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-stone-150 pt-4">
            <Button variant="tertiary" onClick={() => setTestModalOpen(false)}>Close</Button>
            <Button onClick={runRuleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Execute Test'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
