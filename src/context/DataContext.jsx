// ============================================================
// DataContext — the single source of truth for the whole app.
// Loads everything once, exposes derived analytics, and provides
// high-level actions (markAsSent, logResponse, moveStage, …) so the
// UI never touches the storage layer directly.
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { store, usingSupabase, purgeLocalCache, DEFAULT_SETTINGS } from '../lib/store.js'
import { todayKey, addDays } from '../lib/date.js'
import { WIN_RESPONSE } from '../lib/constants.js'
import {
  computeStats,
  computeFunnel,
  cohortByDepartment,
  cohortByChannel,
  cohortByTemplate,
  computeTodayQueue,
  hitDaysFromActivity,
  actionsToday,
} from '../lib/analytics.js'
import { computeStreak } from '../lib/date.js'

const DataContext = createContext(null)
export const useData = () => useContext(DataContext)

// Boot (ensureSeed + loadAll) runs exactly once, even under React 18 StrictMode's
// mount→unmount→mount in dev. We dedupe via a shared promise — so we never seed
// twice — while each mount still resolves it and sets its own state.
let bootPromise = null
function boot() {
  if (!bootPromise) {
    bootPromise = (async () => {
      // In Supabase mode, drop any leftover localStorage data cache from a prior
      // local-only session so it can never shadow the real source of truth.
      if (usingSupabase) purgeLocalCache()
      await store.ensureSeed()
      return store.loadAll()
    })()
  }
  return bootPromise
}

const EMPTY = {
  targets: [],
  templates: [],
  template_notes: [],
  transitions: [],
  activity: [],
  learnings: [],
  settings: { ...DEFAULT_SETTINGS },
}

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── initial load (+ seed if empty) ─────────────────────────
  const refresh = useCallback(async () => {
    const loaded = await store.loadAll()
    setData({ ...EMPTY, ...loaded, settings: { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) } })
  }, [])

  useEffect(() => {
    let cancelled = false
    boot()
      .then((loaded) => {
        if (!cancelled) setData({ ...EMPTY, ...loaded, settings: { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) } })
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError(e.message || 'Failed to load data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── tiny local-state helpers (optimistic updates) ──────────
  const upsertLocal = (table, row, { prepend = true } = {}) =>
    setData((d) => {
      const exists = d[table].some((r) => r.id === row.id)
      const next = exists
        ? d[table].map((r) => (r.id === row.id ? row : r))
        : prepend
          ? [row, ...d[table]]
          : [...d[table], row]
      return { ...d, [table]: next }
    })
  const removeLocal = (table, id) =>
    setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }))

  // ── TARGETS ────────────────────────────────────────────────
  const addTarget = useCallback(async (fields) => {
    const row = await store.insert('targets', sanitizeTarget(fields))
    upsertLocal('targets', row)
    return row
  }, [])

  // Bulk import with de-duplication. A row is a duplicate of an existing target
  // (or of an earlier row in the same batch) by email when present, else by
  // name + lab. Duplicates are skipped; returns { inserted, skipped }.
  const addTargets = useCallback(
    async (list) => {
      const seen = new Set(data.targets.map(dedupKey).filter(Boolean))
      const toInsert = []
      let skipped = 0
      for (const raw of list) {
        const t = sanitizeTarget(raw)
        if (!t.name) {
          skipped++
          continue
        }
        const k = dedupKey(t)
        if (k && seen.has(k)) {
          skipped++
          continue
        }
        if (k) seen.add(k) // also collapses duplicates within the pasted file
        toInsert.push(t)
      }
      let rows = []
      if (toInsert.length) {
        rows = await store.insertMany('targets', toInsert)
        setData((d) => ({ ...d, targets: [...rows, ...d.targets] }))
      }
      return { inserted: rows.length, skipped }
    },
    [data.targets]
  )

  const updateTarget = useCallback(async (id, patch) => {
    const row = await store.update('targets', id, patch)
    upsertLocal('targets', row)
    return row
  }, [])

  const deleteTarget = useCallback(async (id) => {
    await store.remove('targets', id)
    removeLocal('targets', id)
  }, [])

  // Log a status change in the history table (best-effort, non-blocking).
  const logTransition = useCallback(async (target, toStatus) => {
    if (target.status === toStatus) return
    const row = await store.insert('transitions', {
      target_id: target.id,
      from_status: target.status,
      to_status: toStatus,
    })
    upsertLocal('transitions', row)
  }, [])

  /**
   * Mark an outreach action as sent. Handles BOTH a first contact and a follow-up.
   *  - first contact: Prospect → Contacted, sets contact + follow-up dates.
   *  - follow-up: stays Contacted, pushes the follow-up date forward.
   * Always logs an activity row (feeds quota + streak).
   */
  const markAsSent = useCallback(
    async (target, { templateKey, templateVersion, messageText, actionType }) => {
      const today = todayKey()
      const followDays = target.followup_days || data.settings.followup_days || 5
      const isFirst = actionType === 'first_contact' || target.status === 'Prospect'

      const patch = {
        status: isFirst ? 'Contacted' : target.status,
        last_contact_date: new Date().toISOString(),
        next_followup_date: addDays(today, followDays),
        last_message_text: messageText ?? target.last_message_text ?? '',
        last_template_key: templateKey ?? target.last_template_key,
        last_template_version: templateVersion ?? target.last_template_version,
      }
      const updated = await store.update('targets', target.id, patch)
      upsertLocal('targets', updated)

      if (isFirst) await logTransition(target, 'Contacted')

      const act = await store.insert('activity', {
        target_id: target.id,
        action_type: isFirst ? 'first_contact' : 'followup',
        template_key: patch.last_template_key,
        template_version: patch.last_template_version,
        message_text: messageText ?? '',
        activity_date: today,
      })
      upsertLocal('activity', act)
      return updated
    },
    [data.settings.followup_days, logTransition]
  )

  // Move a target to a new pipeline stage (Kanban / dropdown).
  const moveStage = useCallback(
    async (target, toStatus) => {
      const patch = { status: toStatus }
      // Entering a "they replied" stage marks the response timestamp once.
      if (['Responded', 'Demo Scheduled', 'Onboarded'].includes(toStatus) && !target.responded_at) {
        patch.responded_at = new Date().toISOString()
      }
      // Entering "Contacted" without a follow-up date would make the target
      // invisible in the daily queue — give it a contact + follow-up date.
      if (toStatus === 'Contacted' && !target.next_followup_date) {
        const days = target.followup_days || data.settings.followup_days || 5
        patch.last_contact_date = target.last_contact_date || new Date().toISOString()
        patch.next_followup_date = addDays(todayKey(), days)
      }
      const updated = await store.update('targets', target.id, patch)
      upsertLocal('targets', updated)
      await logTransition(target, toStatus)
      return updated
    },
    [logTransition, data.settings.followup_days]
  )

  /**
   * Capture a reply. Returns { firstWin } so the UI can fire the celebration
   * the FIRST time an "Interested" reply is ever logged.
   */
  const logResponse = useCallback(
    async (target, { type, sentiment, quote }) => {
      const ghosted = type === 'Ghosted'
      // A genuine reply always moves forward. From Prospect OR a previously-Lost
      // target, a reply lands on "Responded" (never leave a replier stuck in Lost).
      const nextStatus = ghosted
        ? 'Lost'
        : target.status === 'Prospect' || target.status === 'Lost'
          ? 'Responded'
          : maxStage(target.status, 'Responded')
      const patch = {
        response_type: type,
        response_sentiment: sentiment,
        response_quote: quote || '',
        responded_at: ghosted ? target.responded_at || null : new Date().toISOString(),
        status: nextStatus,
      }
      const updated = await store.update('targets', target.id, patch)
      upsertLocal('targets', updated)
      await logTransition(target, nextStatus)

      const firstWin = type === WIN_RESPONSE && !data.settings.first_win_celebrated
      return { updated, firstWin }
    },
    [data.settings.first_win_celebrated, logTransition]
  )

  // ── TEMPLATES ──────────────────────────────────────────────
  const saveTemplate = useCallback(async (id, patch) => {
    const current = data.templates.find((t) => t.id === id)
    const nextVersion = (current?.version || 1) + (patch.bumpVersion ? 1 : 0)
    const { bumpVersion, ...rest } = patch
    const row = await store.update('templates', id, { ...rest, version: nextVersion })
    upsertLocal('templates', row)
    return row
  }, [data.templates])

  const addTemplateNote = useCallback(async (templateKey, templateVersion, observation) => {
    const row = await store.insert('template_notes', { template_key: templateKey, template_version: templateVersion, observation })
    upsertLocal('template_notes', row)
    return row
  }, [])

  // ── LEARNINGS ──────────────────────────────────────────────
  const addLearning = useCallback(async (kind, content) => {
    const row = await store.insert('learnings', { kind, content })
    upsertLocal('learnings', row)
    return row
  }, [])

  const deleteLearning = useCallback(async (id) => {
    await store.remove('learnings', id)
    removeLocal('learnings', id)
  }, [])

  // ── SETTINGS ───────────────────────────────────────────────
  const updateSettings = useCallback(async (patch) => {
    const row = await store.upsertSettings(patch)
    setData((d) => ({ ...d, settings: { ...d.settings, ...row } }))
    return row
  }, [])

  const markFirstWinCelebrated = useCallback(() => updateSettings({ first_win_celebrated: true }), [updateSettings])

  // Wipe everything, then re-inject the 10 sample researchers.
  const resetToSampleData = useCallback(async () => {
    await store.resetToSample()
    await refresh()
  }, [refresh])

  // Wipe everything to a genuinely empty pipeline — NO sample data re-injected.
  const eraseAllData = useCallback(async () => {
    setData({ ...EMPTY }) // reflect empty immediately
    await store.wipeAll()
    await refresh()
  }, [refresh])

  // ── DERIVED VALUES (memoized) ──────────────────────────────
  const derived = useMemo(() => {
    const { targets, activity, settings } = data
    const quota = settings.daily_quota || 5
    const hits = hitDaysFromActivity(activity, quota)
    return {
      stats: computeStats(targets),
      funnel: computeFunnel(targets),
      cohorts: {
        department: cohortByDepartment(targets),
        channel: cohortByChannel(targets),
        template: cohortByTemplate(targets),
      },
      todayQueue: computeTodayQueue(targets),
      streak: computeStreak(hits),
      doneToday: actionsToday(activity),
      quota,
    }
  }, [data])

  const value = {
    ...data,
    loading,
    error,
    mode: store.mode,
    refresh,
    // targets
    addTarget,
    addTargets,
    updateTarget,
    deleteTarget,
    markAsSent,
    moveStage,
    logResponse,
    // templates
    saveTemplate,
    addTemplateNote,
    // learnings
    addLearning,
    deleteLearning,
    // settings
    updateSettings,
    markFirstWinCelebrated,
    resetToSampleData,
    eraseAllData,
    // derived
    ...derived,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// ── helpers ──────────────────────────────────────────────────
const STAGE_ORDER = ['Prospect', 'Contacted', 'Responded', 'Demo Scheduled', 'Onboarded', 'Lost']
function maxStage(a, b) {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b
}

// Identity key for de-duplication: email (case-insensitive, trimmed) when present,
// otherwise name + lab (name alone if lab is empty). Returns null if no name/email.
function dedupKey(t) {
  const email = (t.email || '').trim().toLowerCase()
  if (email) return `e:${email}`
  const name = (t.name || '').trim().toLowerCase()
  if (!name) return null
  const lab = (t.lab || '').trim().toLowerCase()
  return `n:${name}|${lab}`
}

// Whitelist the fields we persist on a target (drops stray keys from imports/forms).
function sanitizeTarget(f = {}) {
  return {
    name: (f.name || '').trim(),
    email: (f.email || '').trim() || null,
    department: f.department || null,
    lab: f.lab || null,
    research_area: f.research_area || null,
    hook: f.hook || null,
    status: f.status || 'Prospect',
    priority: f.priority || 'Medium',
    scheduled_day: f.scheduled_day || null,
    channel: f.channel || 'Email',
    last_contact_date: f.last_contact_date || null,
    next_followup_date: f.next_followup_date || null,
    followup_days: f.followup_days ?? 5,
    notes: f.notes || null,
    last_message_text: f.last_message_text || null,
    last_template_key: f.last_template_key || null,
    last_template_version: f.last_template_version || null,
    response_type: f.response_type || null,
    response_sentiment: f.response_sentiment || null,
    response_quote: f.response_quote || null,
    responded_at: f.responded_at || null,
  }
}
