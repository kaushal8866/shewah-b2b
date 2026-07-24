/**
 * Configurator rule evaluation.
 *
 * These helpers previously lived in app/api/configurator/validate/route.ts and
 * were imported across route boundaries. Next.js only permits its own reserved
 * exports from a route file, so shared logic belongs in lib/.
 */

/** Evaluate a single `when`/`then` condition against a configuration object. */
export function evaluateCondition(config: any, condition: any): boolean {
  if (!condition || !condition.field) return true

  const { field, equals, not_equals, in: inList, not_in: notInList } = condition

  // Retrieve field value from config (check root level and category_options)
  let val = config[field]
  if (val === undefined && config.category_options) {
    val = config.category_options[field]
  }

  // Normalize string comparisons to lowercase
  const normalize = (v: any) => (typeof v === 'string' ? v.toLowerCase() : v)
  const normalizedVal = normalize(val)

  if (equals !== undefined) {
    return normalizedVal === normalize(equals)
  }
  if (not_equals !== undefined) {
    return normalizedVal !== normalize(not_equals)
  }
  if (inList !== undefined && Array.isArray(inList)) {
    return inList.map(normalize).includes(normalizedVal)
  }
  if (notInList !== undefined && Array.isArray(notInList)) {
    return !notInList.map(normalize).includes(normalizedVal)
  }

  return false
}

/** Evaluate a rule against a configuration. Returns null when it does not apply. */
export function checkRuleViolation(
  config: any,
  rule: any,
): { violated: boolean; message: string; action: string } | null {
  const conds = rule.conditions
  if (!conds || !conds.when || !conds.then) return null

  // Check if "when" condition is met
  const whenMet = evaluateCondition(config, conds.when)
  if (!whenMet) return null // Rule does not apply

  // Check if "then" condition is violated
  const thenSatisfied = evaluateCondition(config, conds.then)

  if (!thenSatisfied) {
    return {
      violated: true,
      message: rule.action_message || `Rule violation: ${rule.name}`,
      action: rule.action,
    }
  }

  return null
}
