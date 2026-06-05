// ============================================================
// THE DATA LAYER — one API, two interchangeable backends.
//
//   • If Supabase is configured  → reads/writes Postgres (multi-device, secure).
//   • Otherwise                   → reads/writes browser localStorage (single device).
//
// Every method returns a Promise so the rest of the app never cares which
// backend is live. The shapes returned are identical in both modes.
//
// SEEDING RULE (important): sample data is injected exactly ONCE per account,
// on first ever load. We track "initialized" by a persistent marker — the
// existence of a settings row (Supabase) or a 'seeded' flag (local) — NOT by
// "is the targets table empty". That distinction is what lets you clear the app
// to a genuinely empty state without it re-seeding itself on the next refresh.
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase.js'
import { buildSeedTargets, buildSeedTemplates } from './seed.js'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.round(performance.now())}`)
const now = () => new Date().toISOString()
const withMeta = (r) => ({ id: uid(), created_at: now(), updated_at: now(), ...r })

// Date/timestamptz columns. Postgres rejects '' for these, so every write path
// coerces empty strings (and undefined) to null. Done centrally so no caller —
// the edit form, imports, bulk actions — can ever send a bad value again.
const DATE_COLUMNS = ['last_contact_date', 'next_followup_date', 'responded_at', 'activity_date']
function normalizeDates(row) {
  if (!row || typeof row !== 'object') return row
  const out = { ...row }
  for (const k of DATE_COLUMNS) {
    if (k in out && (out[k] === '' || out[k] === undefined)) out[k] = null
  }
  return out
}

export const DEFAULT_SETTINGS = {
  daily_quota: 5,
  followup_days: 5,
  pivot_after_contacts: 50,
  pivot_min_rate: 5,
  pivot_check_interval: 20,
  first_win_celebrated: false,
}

// The tables we round-trip, in dependency order.
const TABLES = ['targets', 'templates', 'template_notes', 'transitions', 'activity', 'learnings']
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

/* ============================================================
   localStorage helpers
   ============================================================ */
const LS_PREFIX = 'skophos.'
const lsKey = (t) => LS_PREFIX + t
// Device-local UX state that is NOT account data — keep it across data purges.
const UX_KEYS = new Set([lsKey('gate'), lsKey('pivotSeen'), lsKey('baselineDismissedAt')])

function lsGet(table, fallback = []) {
  try {
    const raw = localStorage.getItem(lsKey(table))
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function lsSet(table, value) {
  localStorage.setItem(lsKey(table), JSON.stringify(value))
  return value
}

/**
 * Remove our localStorage DATA keys (targets/templates/.../settings/seeded).
 * Used on boot in Supabase mode so a leftover local cache from a previous
 * localStorage-only session can never shadow the real Supabase data.
 */
export function purgeLocalCache() {
  for (const t of [...TABLES, 'settings', 'seeded']) localStorage.removeItem(lsKey(t))
}

/** Wipe every skophos.* key except device-local UX state. */
function purgeAllLocal() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LS_PREFIX) && !UX_KEYS.has(k)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/* ============================================================
   localStorage backend
   ============================================================ */
const localBackend = {
  mode: 'local',

  async loadAll() {
    const data = {}
    for (const t of TABLES) data[t] = lsGet(t, [])
    data.settings = lsGet('settings', null) || { ...DEFAULT_SETTINGS }
    return data
  },

  // Seed only if this device has never been initialized.
  async ensureSeed() {
    if (localStorage.getItem(lsKey('seeded'))) return false
    this._seedFresh()
    return true
  },

  _seedFresh() {
    lsSet('targets', buildSeedTargets().map(withMeta))
    lsSet('templates', buildSeedTemplates().map(withMeta))
    lsSet('settings', { ...DEFAULT_SETTINGS })
    localStorage.setItem(lsKey('seeded'), '1')
  },

  // Wipe everything and re-inject the 10 sample researchers.
  async resetToSample() {
    purgeAllLocal()
    this._seedFresh()
    return true
  },

  // Wipe everything to a genuinely empty pipeline (no sample contacts).
  // The two message templates are app scaffolding, so they're recreated.
  async wipeAll() {
    purgeAllLocal()
    lsSet('targets', [])
    lsSet('template_notes', [])
    lsSet('transitions', [])
    lsSet('activity', [])
    lsSet('learnings', [])
    lsSet('templates', buildSeedTemplates().map(withMeta))
    lsSet('settings', { ...DEFAULT_SETTINGS })
    localStorage.setItem(lsKey('seeded'), '1') // mark initialized so boot won't reseed
    return true
  },

  async insert(table, row) {
    const record = withMeta(normalizeDates(row))
    lsSet(table, [record, ...lsGet(table, [])])
    return record
  },

  async insertMany(table, newRows) {
    const records = newRows.map((r) => withMeta(normalizeDates(r)))
    lsSet(table, [...records, ...lsGet(table, [])])
    return records
  },

  async update(table, id, patch) {
    const clean = normalizeDates(patch)
    let updated = null
    const next = lsGet(table, []).map((r) => {
      if (r.id === id) {
        updated = { ...r, ...clean, updated_at: now() }
        return updated
      }
      return r
    })
    lsSet(table, next)
    return updated
  },

  async remove(table, id) {
    lsSet(table, lsGet(table, []).filter((r) => r.id !== id))
    return true
  },

  async upsertSettings(patch) {
    const current = lsGet('settings', null) || { ...DEFAULT_SETTINGS }
    return lsSet('settings', { ...current, ...patch, updated_at: now() })
  },
}

/* ============================================================
   Supabase backend
   ============================================================ */
const supaBackend = {
  mode: 'supabase',

  async loadAll() {
    const out = {}
    await Promise.all(
      TABLES.map(async (t) => {
        const { data, error } = await supabase
          .from(t)
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }) // stable tiebreaker for same-timestamp batch inserts
        if (error) throw error
        out[t] = data || []
      })
    )
    const { data: settings } = await supabase.from('settings').select('*').maybeSingle()
    out.settings = settings || { ...DEFAULT_SETTINGS }
    return out
  },

  // "Initialized" = a settings row exists (our durable marker, which survives
  // clearing all targets) OR the account already has targets (legacy safety so
  // we never inject samples on top of real data). Seeding only happens on a
  // truly brand-new, empty account.
  async _initialized() {
    const { data, error } = await supabase.from('settings').select('owner').maybeSingle()
    if (error) throw error
    if (data) return true
    const { count, error: cErr } = await supabase.from('targets').select('id', { count: 'exact', head: true })
    if (cErr) throw cErr
    return (count || 0) > 0
  },

  async ensureSeed() {
    if (await this._initialized()) return false
    await supabase.from('targets').insert(buildSeedTargets())
    await supabase.from('templates').insert(buildSeedTemplates())
    await this.upsertSettings({ ...DEFAULT_SETTINGS })
    return true
  },

  // Delete every data row this user owns (RLS keeps it scoped to them).
  // Leaves the settings row in place (the "initialized" marker).
  async _wipeRows() {
    for (const t of TABLES) {
      const { error } = await supabase.from(t).delete().neq('id', ZERO_UUID)
      if (error) throw error
    }
  },

  async resetToSample() {
    await this._wipeRows()
    await supabase.from('targets').insert(buildSeedTargets())
    await supabase.from('templates').insert(buildSeedTemplates())
    await this.upsertSettings({ ...DEFAULT_SETTINGS })
    purgeLocalCache()
    return true
  },

  async wipeAll() {
    await this._wipeRows()
    // Recreate the two message templates (app scaffolding) + the settings row
    // (functional defaults + the "initialized" marker). No sample contacts.
    await supabase.from('templates').insert(buildSeedTemplates())
    await this.upsertSettings({ ...DEFAULT_SETTINGS })
    purgeLocalCache()
    return true
  },

  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(normalizeDates(row)).select().single()
    if (error) throw error
    return data
  },

  async insertMany(table, rows) {
    const { data, error } = await supabase.from(table).insert(rows.map(normalizeDates)).select()
    if (error) throw error
    return data
  },

  async update(table, id, patch) {
    const { data, error } = await supabase.from(table).update(normalizeDates(patch)).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    return true
  },

  async upsertSettings(patch) {
    // settings.owner is the PK and defaults to auth.uid(); upsert on conflict.
    const { data: userRes } = await supabase.auth.getUser()
    const owner = userRes?.user?.id
    const { data, error } = await supabase
      .from('settings')
      .upsert({ owner, ...patch }, { onConflict: 'owner' })
      .select()
      .single()
    if (error) throw error
    return data
  },
}

export const store = isSupabaseConfigured ? supaBackend : localBackend
export const usingSupabase = isSupabaseConfigured
