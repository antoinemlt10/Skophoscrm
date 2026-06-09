// ============================================================
// GET /api/cockpit-metrics  — read-only KPI feed for the "Mon Cockpit" app.
//
// Runs as a Vercel Serverless Function (server-side). It reads aggregates from
// Supabase using the SERVICE ROLE key (never shipped to the browser) and returns
// ONLY anonymous totals — never a single contact's name, email, message, etc.
//
// Response shape (generic key/label/value/unit/trend/target):
// {
//   "updatedAt": "2026-06-08T10:00:00Z",
//   "metrics": [
//     { "key": "contacted",     "label": "Personnes contactées", "value": 240, "unit": "",  "trend": 18 },
//     { "key": "response_rate", "label": "Taux de réponse",      "value": 32,  "unit": "%", "trend": 2.4 },
//     { "key": "onboarded",     "label": "Personnes onboardées", "value": 41,  "unit": "",  "trend": 6, "target": 60 }
//   ]
// }
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL                 (or falls back to VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    (SECRET — server only, NOT prefixed with VITE_)
//   COCKPIT_API_TOKEN            (optional) when set, require Authorization: Bearer <token>
//   COCKPIT_ALLOWED_ORIGINS      (optional) comma-separated; default "http://localhost:5174"
//   COCKPIT_ONBOARD_TARGET       (optional) onboarding goal; default 5
// ============================================================
import { createClient } from '@supabase/supabase-js'

const DAY = 24 * 60 * 60 * 1000

const ENV = (k) => (process.env[k] || '').trim()
const SUPABASE_URL = ENV('SUPABASE_URL') || ENV('VITE_SUPABASE_URL')
const SERVICE_KEY = ENV('SUPABASE_SERVICE_ROLE_KEY')
const API_TOKEN = ENV('COCKPIT_API_TOKEN')
const ALLOWED_ORIGINS = (ENV('COCKPIT_ALLOWED_ORIGINS') || 'http://localhost:5174')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ONBOARD_TARGET = Number(ENV('COCKPIT_ONBOARD_TARGET')) || 5

const round1 = (n) => Math.round(n * 10) / 10
const inRange = (value, start, end) => {
  if (!value) return false
  const t = new Date(value).getTime()
  return Number.isFinite(t) && t >= start && t < end
}

const isReached = (t) => Boolean(t.last_contact_date) || t.status !== 'Prospect'
const isResponded = (t) =>
  Boolean(t.responded_at) || ['Responded', 'Demo Scheduled', 'Onboarded'].includes(t.status)

/**
 * Pure aggregation — no I/O, easy to test. Given the raw rows, returns the
 * full response payload. `trend` compares the current 30-day window to the
 * previous one; `value` is the current cumulative figure.
 */
export function computeMetrics(targets = [], onboardEvents = [], { now = Date.now(), onboardTarget = 5 } = {}) {
  const rows = targets || []
  const w0 = now - 30 * DAY // start of current 30-day window
  const w1 = now - 60 * DAY // start of previous 30-day window

  // contacted
  const reached = rows.filter(isReached)
  const contactedRecent = rows.filter((t) => inRange(t.last_contact_date, w0, now)).length
  const contactedPrev = rows.filter((t) => inRange(t.last_contact_date, w1, w0)).length

  // response rate = responses / contacted × 100
  const responded = reached.filter(isResponded)
  const responseRate = reached.length ? (responded.length / reached.length) * 100 : 0
  // momentum: response rate of this window's cohort vs the previous window's
  const cohort = (start, end) => rows.filter((t) => inRange(t.last_contact_date, start, end))
  const cohortRate = (list) => (list.length ? (list.filter(isResponded).length / list.length) * 100 : 0)
  const rateTrend = round1(cohortRate(cohort(w0, now)) - cohortRate(cohort(w1, w0)))

  // onboarded
  const onboardedValue = rows.filter((t) => t.status === 'Onboarded').length
  const events = onboardEvents || []
  const onboardRecent = events.filter((e) => inRange(e.created_at, w0, now)).length
  const onboardPrev = events.filter((e) => inRange(e.created_at, w1, w0)).length

  return {
    updatedAt: new Date(now).toISOString(),
    metrics: [
      { key: 'contacted', label: 'Personnes contactées', value: reached.length, unit: '', trend: contactedRecent - contactedPrev },
      { key: 'response_rate', label: 'Taux de réponse', value: round1(responseRate), unit: '%', trend: rateTrend },
      { key: 'onboarded', label: 'Personnes onboardées', value: onboardedValue, unit: '', trend: onboardRecent - onboardPrev, target: onboardTarget },
    ],
  }
}

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────
  const origin = req.headers.origin
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── Auth (only enforced when a token is configured → "si en ligne") ─────
  if (API_TOKEN) {
    const header = req.headers.authorization || ''
    const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (provided !== API_TOKEN) return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase is not configured for this endpoint.' })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Pull ONLY the non-sensitive columns we need to aggregate.
    const [{ data: targets, error: tErr }, { data: onboardEvents, error: oErr }] = await Promise.all([
      supabase.from('targets').select('status,last_contact_date,responded_at'),
      supabase.from('transitions').select('created_at').eq('to_status', 'Onboarded'),
    ])
    if (tErr) throw tErr
    if (oErr) throw oErr

    const payload = computeMetrics(targets, onboardEvents, { now: Date.now(), onboardTarget: ONBOARD_TARGET })

    // Small CDN cache so the cockpit can poll without hammering the DB.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(payload)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to compute metrics', detail: err.message })
  }
}
