// ============================================================
// Sample data so the app is alive the first time you open it.
// 10 fictional UC Berkeley researchers across the four target
// departments, a realistic spread of pipeline stages, and the two
// default templates. Dates are computed relative to "now" so the
// Daily Dashboard always has something to do today.
//
// NOTE: these are invented people for demo purposes — not real contacts.
// ============================================================
import { DEFAULT_TEMPLATES } from './constants.js'
import { todayKey, addDays, todayWeekday } from './date.js'

export function buildSeedTargets() {
  const today = todayKey()
  const T = todayWeekday()

  // Helper to keep the list readable.
  const t = (o) => ({
    email: '',
    department: '',
    lab: '',
    research_area: '',
    hook: '',
    status: 'Prospect',
    priority: 'Medium',
    scheduled_day: null,
    channel: 'Email',
    last_contact_date: null,
    next_followup_date: null,
    followup_days: 5,
    notes: '',
    last_message_text: '',
    last_template_key: null,
    last_template_version: null,
    response_type: null,
    response_sentiment: null,
    response_quote: null,
    responded_at: null,
    ...o,
  })

  return [
    // ── To reach TODAY (Prospects scheduled for today) ──────────────
    t({
      name: 'Dr. Lena Ortiz', email: 'lortiz@berkeley.edu',
      department: 'Neuroscience', lab: 'Helen Wills Neuroscience Institute',
      research_area: 'Memory & hippocampal circuits', priority: 'High', scheduled_day: T,
      hook: 'your recent work on hippocampal replay during sleep',
    }),
    t({
      name: 'Marcus Feng', email: 'mfeng@berkeley.edu',
      department: 'Bioengineering', lab: 'Healy Lab',
      research_area: 'Organ-on-chip microfluidics', priority: 'High', scheduled_day: T,
      hook: 'your microfluidic organ-on-chip platform',
    }),
    t({
      name: 'Priya Nair', email: 'pnair@berkeley.edu',
      department: 'Public Health', lab: 'Environmental Health Sciences',
      research_area: 'Air pollution epidemiology', priority: 'Medium', scheduled_day: T,
      hook: 'your study linking wildfire smoke to cardiac outcomes',
    }),

    // ── Follow-ups DUE (Contacted, follow-up date today/overdue) ─────
    t({
      name: 'Hannah Beck', email: 'hbeck@berkeley.edu',
      department: 'Neuroscience', lab: 'Theunissen Lab',
      research_area: 'Computational models of attention', priority: 'High',
      status: 'Contacted', last_contact_date: addDays(today, -5),
      next_followup_date: today, followup_days: 5,
      last_template_key: 'first_contact', last_template_version: 1,
      last_message_text: 'Hi Hannah, I came across your work in Neuroscience…',
    }),
    t({
      name: 'Diego Alvarez', email: 'dalvarez@berkeley.edu',
      department: 'Bioengineering', lab: 'Murthy Lab',
      research_area: 'Lipid nanoparticle delivery', priority: 'Medium',
      status: 'Contacted', last_contact_date: addDays(today, -8),
      next_followup_date: addDays(today, -3), followup_days: 5,
      last_template_key: 'first_contact', last_template_version: 1,
      last_message_text: 'Hi Diego, I came across your work in Bioengineering…',
    }),

    // ── In-flight (Contacted, follow-up later) ──────────────────────
    t({
      name: 'Dr. Yuki Tanaka', email: 'ytanaka@berkeley.edu',
      department: 'Public Health', lab: 'Global Health Group',
      research_area: 'Malaria transmission modeling', priority: 'Medium',
      status: 'Contacted', last_contact_date: addDays(today, -2),
      next_followup_date: addDays(today, 3), followup_days: 5, channel: 'LinkedIn',
      last_template_key: 'first_contact', last_template_version: 1,
      last_message_text: 'Hi Yuki, I came across your work in Public Health…',
    }),

    // ── A reply that is NOT a win yet (keeps your first "Interested" special) ─
    t({
      name: 'Rebecca Stone', email: 'rstone@berkeley.edu',
      department: 'Chemistry', lab: 'Leone Lab',
      research_area: 'Ultrafast spectroscopy of photocatalysts', priority: 'Medium',
      status: 'Responded', last_contact_date: addDays(today, -6),
      next_followup_date: null, followup_days: 5,
      response_type: 'Not now', response_sentiment: 'Neutral',
      response_quote: 'Interesting idea — completely swamped until the summer though.',
      responded_at: addDays(today, -1),
      last_template_key: 'first_contact', last_template_version: 1,
      last_message_text: 'Hi Rebecca, I came across your work in Chemistry…',
    }),

    // ── A closed-out one (funnel needs a Lost) ──────────────────────
    t({
      name: 'Tom Becker', email: 'tbecker@berkeley.edu',
      department: 'Bioengineering', lab: 'Schaffer Lab',
      research_area: 'Gene therapy vectors', priority: 'Low',
      status: 'Lost', last_contact_date: addDays(today, -16),
      response_type: 'Ghosted', response_sentiment: 'Negative',
      last_template_key: 'first_contact', last_template_version: 1,
    }),

    // ── Scheduled later in the week ─────────────────────────────────
    t({
      name: 'Dr. Sam Whitfield', email: 'swhitfield@berkeley.edu',
      department: 'Chemistry', lab: 'Toste Lab',
      research_area: 'Single-atom catalysis', priority: 'Medium',
      scheduled_day: nextWeekday(T, 1),
      hook: 'your single-atom catalysis papers in Nature Catalysis',
    }),
    t({
      name: 'Dr. Aisha Rahman', email: 'arahman@berkeley.edu',
      department: 'Neuroscience', lab: 'Adesnik Lab',
      research_area: 'Cortical microcircuits & optogenetics', priority: 'Low',
      scheduled_day: nextWeekday(T, 2), channel: 'LinkedIn',
      hook: 'your all-optical interrogation of cortical circuits',
    }),
  ].map(normalizeTimestamps)
}

export function buildSeedTemplates() {
  return DEFAULT_TEMPLATES.map((t) => ({ ...t, version: 1 }))
}

// Bump a weekday name forward by N days (wraps around the week).
function nextWeekday(day, n) {
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const i = order.indexOf(day)
  return order[(i + n) % 7]
}

// `last_contact_date` and `responded_at` are timestamptz columns. Seed values
// are day-keys ('YYYY-MM-DD'); store them as full ISO timestamps (noon local,
// to avoid a timezone off-by-one when displayed) so they match real app writes.
function toTimestamp(dayKey) {
  return dayKey ? new Date(`${dayKey}T12:00:00`).toISOString() : null
}
function normalizeTimestamps(t) {
  return {
    ...t,
    last_contact_date: toTimestamp(t.last_contact_date),
    responded_at: toTimestamp(t.responded_at),
  }
}
