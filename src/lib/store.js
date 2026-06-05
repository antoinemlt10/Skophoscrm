// ============================================================
// THE DATA LAYER — one API, two interchangeable backends.
//
//   • If Supabase is configured  → reads/writes Postgres (multi-device, secure).
//   • Otherwise                   → reads/writes browser localStorage (single device).
//
// Every method returns a Promise so the rest of the app never cares which
// backend is live. The shapes returned are identical in both modes.
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase.js'
import { buildSeedTargets, buildSeedTemplates } from './seed.js'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.round(performance.now())}`)
const now = () => new Date().toISOString()

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

/* ============================================================
   localStorage backend
   ============================================================ */
const LS_PREFIX = 'skophos.'
const lsKey = (t) => LS_PREFIX + t

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

const localBackend = {
  mode: 'local',

  async loadAll() {
    const data = {}
    for (const t of TABLES) data[t] = lsGet(t, [])
    data.settings = lsGet('settings', null) || { ...DEFAULT_SETTINGS }
    return data
  },

  async ensureSeed() {
    if (lsGet('targets', []).length === 0 && !localStorage.getItem(lsKey('seeded'))) {
      const targets = buildSeedTargets().map((t) => ({ id: uid(), created_at: now(), updated_at: now(), ...t }))
      const templates = buildSeedTemplates().map((t) => ({ id: uid(), created_at: now(), updated_at: now(), ...t }))
      lsSet('targets', targets)
      lsSet('templates', templates)
      lsSet('settings', { ...DEFAULT_SETTINGS })
      localStorage.setItem(lsKey('seeded'), '1')
      return true
    }
    return false
  },

  async insert(table, row) {
    const rows = lsGet(table, [])
    const record = { id: uid(), created_at: now(), updated_at: now(), ...row }
    lsSet(table, [record, ...rows])
    return record
  },

  async insertMany(table, newRows) {
    const rows = lsGet(table, [])
    const records = newRows.map((r) => ({ id: uid(), created_at: now(), updated_at: now(), ...r }))
    lsSet(table, [...records, ...rows])
    return records
  },

  async update(table, id, patch) {
    const rows = lsGet(table, [])
    let updated = null
    const next = rows.map((r) => {
      if (r.id === id) {
        updated = { ...r, ...patch, updated_at: now() }
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
    const next = { ...current, ...patch, updated_at: now() }
    return lsSet('settings', next)
  },

  async clearAll() {
    for (const t of [...TABLES, 'settings', 'seeded']) localStorage.removeItem(lsKey(t))
    return true
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

  async ensureSeed() {
    const { count, error } = await supabase.from('targets').select('id', { count: 'exact', head: true })
    if (error) throw error
    if (count && count > 0) return false
    // Seed only when the account is empty.
    await supabase.from('targets').insert(buildSeedTargets())
    await supabase.from('templates').insert(buildSeedTemplates())
    await supaBackend.upsertSettings({ ...DEFAULT_SETTINGS })
    return true
  },

  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw error
    return data
  },

  async insertMany(table, rows) {
    const { data, error } = await supabase.from(table).insert(rows).select()
    if (error) throw error
    return data
  },

  async update(table, id, patch) {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
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

  async clearAll() {
    // Deletes every row you own (RLS keeps it scoped to you).
    for (const t of TABLES) await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    return true
  },
}

export const store = isSupabaseConfigured ? supaBackend : localBackend
export const usingSupabase = isSupabaseConfigured
