// ============================================================
// Template merge engine. Replaces [Name], [Department], [Lab], [Hook]
// with values from a target. Unknown/empty fields degrade gracefully.
// ============================================================

const FALLBACKS = {
  '[Name]': 'there',
  '[Department]': 'your department',
  '[Lab]': 'your lab',
  '[Hook]': 'your recent work',
}

/** Merge a single string against a target. */
export function mergeString(text = '', target = {}) {
  const map = {
    '[Name]': firstName(target.name) || FALLBACKS['[Name]'],
    '[Department]': target.department || FALLBACKS['[Department]'],
    '[Lab]': target.lab || FALLBACKS['[Lab]'],
    '[Hook]': target.hook || FALLBACKS['[Hook]'],
  }
  return text.replace(/\[(Name|Department|Lab|Hook)\]/g, (m) => map[m] ?? m)
}

/** Merge a whole template → { subject, body }. */
export function mergeTemplate(template, target) {
  if (!template) return { subject: '', body: '' }
  return {
    subject: mergeString(template.subject || '', target),
    body: mergeString(template.body || '', target),
  }
}

/** First name only — outreach feels more human than a full legal name. */
export function firstName(full = '') {
  const cleaned = full.replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').trim()
  return cleaned.split(/\s+/)[0] || ''
}

/** Which merge vars in this template have no value for the given target. */
export function missingVars(template, target) {
  const text = `${template?.subject || ''} ${template?.body || ''}`
  const used = new Set(text.match(/\[(Name|Department|Lab|Hook)\]/g) || [])
  const keyOf = { '[Name]': 'name', '[Department]': 'department', '[Lab]': 'lab', '[Hook]': 'hook' }
  return [...used].filter((v) => !target?.[keyOf[v]]).map((v) => v.replace(/[[\]]/g, ''))
}
