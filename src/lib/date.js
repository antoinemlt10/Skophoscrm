// ============================================================
// Small, dependency-free date helpers. All "day" math is done in
// the user's LOCAL timezone so "today" matches what's on the clock.
// ============================================================

const pad = (n) => String(n).padStart(2, '0')

/** YYYY-MM-DD for a Date (local time). This is our canonical "day" key. */
export function toDayKey(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey() {
  return toDayKey(new Date())
}

/** Add N days to a day-key (or Date) and return a new day-key. */
export function addDays(dayKeyOrDate, n) {
  const base = dayKeyOrDate instanceof Date ? new Date(dayKeyOrDate) : new Date(`${dayKeyOrDate}T00:00:00`)
  base.setDate(base.getDate() + n)
  return toDayKey(base)
}

/** Whole days between two day-keys (b - a). Negative if b is before a. */
export function daysBetween(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00`)
  const b = new Date(`${bKey}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

/** Is this due date today or in the past? (empty = not due) */
export function isOverdue(dueDayKey, ref = todayKey()) {
  if (!dueDayKey) return false
  return dueDayKey <= ref
}

/** Three-letter weekday for a date, matching DAYS in constants. */
export function weekdayOf(d = new Date()) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d).getDay()]
}

export function todayWeekday() {
  return weekdayOf(new Date())
}

/** Human relative label: "Today", "Tomorrow", "in 3d", "2d overdue". */
export function relativeDay(dayKey, ref = todayKey()) {
  if (!dayKey) return '—'
  const diff = daysBetween(ref, dayKey)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return `in ${diff}d`
}

/** Friendly date like "Jun 4". */
export function shortDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Compute the consecutive-day streak from a set of day-keys that "hit quota".
 * A streak is alive if today OR yesterday hit quota (so you don't lose it
 * mid-morning before you've started today's batch).
 */
export function computeStreak(hitDayKeys) {
  const hits = new Set(hitDayKeys)
  const today = todayKey()
  const yesterday = addDays(today, -1)
  // Anchor: start counting from today if done, else yesterday if done, else 0.
  let cursor = hits.has(today) ? today : hits.has(yesterday) ? yesterday : null
  if (!cursor) return 0
  let streak = 0
  while (hits.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}
