// ============================================================
// Pure analytics — no React, no I/O. Give it the raw arrays and it
// returns the numbers the dashboards render. Easy to reason about & test.
// ============================================================
import { STAGES } from './constants.js'
import { todayKey, todayWeekday, isOverdue } from './date.js'

/** Has this target been reached at least once? */
export const isReached = (t) => Boolean(t.last_contact_date) || t.status !== 'Prospect'

/** Did this target actually reply? (Ghosted ≠ replied) */
export const isResponded = (t) =>
  Boolean(t.responded_at) || ['Responded', 'Demo Scheduled', 'Onboarded'].includes(t.status)

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)

/** Headline numbers for the stats bar. */
export function computeStats(targets) {
  const total = targets.length
  const reached = targets.filter(isReached)
  const responded = targets.filter(isResponded)
  const onboarded = targets.filter((t) => t.status === 'Onboarded')
  const awaitingFollowup = targets.filter((t) => t.status === 'Contacted')
  const overdue = targets.filter((t) => t.status === 'Contacted' && isOverdue(t.next_followup_date))

  return {
    total,
    reachedCount: reached.length,
    respondedCount: responded.length,
    onboardedCount: onboarded.length,
    awaitingCount: awaitingFollowup.length,
    overdueCount: overdue.length,
    responseRate: pct(responded.length, reached.length),
    onboardRate: pct(onboarded.length, reached.length),
  }
}

/** Cumulative funnel: each stage counts targets at-or-beyond it (Lost excluded). */
export function computeFunnel(targets) {
  const flow = STAGES.filter((s) => s !== 'Lost')
  const rank = (s) => flow.indexOf(s)
  return flow.map((stage) => ({
    stage,
    count: targets.filter((t) => t.status !== 'Lost' && rank(t.status) >= rank(stage)).length,
  }))
}

/** Generic cohort breakdown by a field accessor → [{ key, reached, responded, rate }]. */
export function computeCohort(targets, keyFn, { reachedOnly = true } = {}) {
  const buckets = new Map()
  for (const t of targets) {
    if (reachedOnly && !isReached(t)) continue
    const key = keyFn(t) || '—'
    if (!buckets.has(key)) buckets.set(key, { key, reached: 0, responded: 0 })
    const b = buckets.get(key)
    b.reached += 1
    if (isResponded(t)) b.responded += 1
  }
  return [...buckets.values()]
    .map((b) => ({ ...b, rate: pct(b.responded, b.reached) }))
    .sort((a, b) => b.reached - a.reached)
}

export const cohortByDepartment = (targets) => computeCohort(targets, (t) => t.department)
export const cohortByChannel = (targets) => computeCohort(targets, (t) => t.channel)
export const cohortByTemplate = (targets) =>
  computeCohort(
    targets.filter((t) => t.last_template_key),
    (t) => `${labelTemplate(t.last_template_key)} v${t.last_template_version || 1}`
  )

function labelTemplate(key) {
  return key === 'first_contact' ? 'First Contact' : key === 'followup_bump' ? 'Follow-up' : key
}

/**
 * What to do TODAY. Two buckets:
 *   • firstContacts — Prospects scheduled for today's weekday
 *   • followups     — Contacted targets whose follow-up is due today or overdue
 * Both count toward the daily quota.
 */
export function computeTodayQueue(targets) {
  const wd = todayWeekday()
  const today = todayKey()

  const firstContacts = targets.filter((t) => t.status === 'Prospect' && t.scheduled_day === wd)
  // Due = follow-up date is today/past, OR a Contacted target has no date set
  // (which would otherwise make it invisible — never strand an action).
  const followups = targets
    .filter((t) => t.status === 'Contacted' && (!t.next_followup_date || isOverdue(t.next_followup_date, today)))
    .sort((a, b) => (a.next_followup_date || '').localeCompare(b.next_followup_date || ''))

  // Gentle fallback so the cockpit is never empty when there's clearly work:
  // unscheduled Prospects, highest priority first.
  const priorityRank = { High: 0, Medium: 1, Low: 2 }
  const unscheduled = targets
    .filter((t) => t.status === 'Prospect' && !t.scheduled_day)
    .sort((a, b) => (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1))

  return { firstContacts, followups, unscheduled, weekday: wd }
}

/** Set of day-keys where the quota was hit, from activity rows + quota. */
export function hitDaysFromActivity(activity, quota) {
  const counts = new Map()
  for (const a of activity) counts.set(a.activity_date, (counts.get(a.activity_date) || 0) + 1)
  const hits = []
  for (const [day, n] of counts) if (n >= quota) hits.push(day)
  return hits
}

/** How many actions were logged today. */
export function actionsToday(activity) {
  const today = todayKey()
  return activity.filter((a) => a.activity_date === today).length
}
