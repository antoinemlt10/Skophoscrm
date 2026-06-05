// ============================================================
// SETTINGS — tune the engine: daily goal, follow-up window, pivot
// thresholds. Plus full data export and a reset.
// ============================================================
import { useState } from 'react'
import { Database, HardDrive, Download, RotateCcw, Save } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Field, Input, SectionTitle, Badge } from '../components/ui.jsx'
import { toCSV, downloadFile } from '../lib/csv.js'

export default function Settings() {
  const { settings, updateSettings, mode, targets, learnings, template_notes, clearAllData } = useData()
  const toast = useToast()
  const [form, setForm] = useState({
    daily_quota: settings.daily_quota,
    followup_days: settings.followup_days,
    pivot_after_contacts: settings.pivot_after_contacts,
    pivot_min_rate: settings.pivot_min_rate,
    pivot_check_interval: settings.pivot_check_interval,
  })
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setBusy(true)
    try {
      await updateSettings({
        daily_quota: clamp(form.daily_quota, 1, 50),
        followup_days: clamp(form.followup_days, 1, 60),
        pivot_after_contacts: clamp(form.pivot_after_contacts, 1, 1000),
        pivot_min_rate: clamp(form.pivot_min_rate, 0, 100),
        pivot_check_interval: clamp(form.pivot_check_interval, 1, 200),
      })
      toast('Settings saved')
    } catch (e) {
      toast(e.message || 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadFile(
      `skophos-targets-${stamp}.csv`,
      toCSV(targets, [
        { label: 'Name', get: (t) => t.name }, { label: 'Email', get: (t) => t.email },
        { label: 'Department', get: (t) => t.department }, { label: 'Lab', get: (t) => t.lab },
        { label: 'Research area', get: (t) => t.research_area }, { label: 'Hook', get: (t) => t.hook },
        { label: 'Channel', get: (t) => t.channel }, { label: 'Priority', get: (t) => t.priority },
        { label: 'Status', get: (t) => t.status }, { label: 'Last contact', get: (t) => t.last_contact_date },
        { label: 'Next follow-up', get: (t) => t.next_followup_date },
        { label: 'Response type', get: (t) => t.response_type }, { label: 'Sentiment', get: (t) => t.response_sentiment },
        { label: 'Response quote', get: (t) => t.response_quote }, { label: 'Last message', get: (t) => t.last_message_text },
        { label: 'Notes', get: (t) => t.notes },
      ])
    )
    if (learnings.length)
      downloadFile(`skophos-learnings-${stamp}.csv`, toCSV(learnings, [
        { label: 'Type', get: (l) => l.kind }, { label: 'Content', get: (l) => l.content }, { label: 'Date', get: (l) => l.created_at },
      ]))
    if (template_notes.length)
      downloadFile(`skophos-iterations-${stamp}.csv`, toCSV(template_notes, [
        { label: 'Template', get: (n) => n.template_key }, { label: 'Version', get: (n) => n.template_version },
        { label: 'Observation', get: (n) => n.observation }, { label: 'Date', get: (n) => n.created_at },
      ]))
    toast('Exported all data')
  }

  const reset = async () => {
    if (!window.confirm('Erase ALL data and reload the 10 sample targets? This cannot be undone.')) return
    setBusy(true)
    try {
      await clearAllData()
      toast('Reset to sample data')
    } catch (e) {
      toast(e.message || 'Reset failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle title="Settings" />

      {/* storage */}
      <div className="card flex items-center gap-3">
        {mode === 'supabase' ? <Database size={20} className="text-success" /> : <HardDrive size={20} className="text-info" />}
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">Storage: {mode === 'supabase' ? 'Supabase (cloud)' : 'Local browser'}</p>
          <p className="text-xs text-muted">{mode === 'supabase' ? 'Synced and private to your account, available on any device.' : 'Saved only in this browser. Add Supabase keys to sync across devices.'}</p>
        </div>
        <Badge tone={mode === 'supabase' ? 'success' : 'info'}>{mode === 'supabase' ? 'Cloud' : 'Local'}</Badge>
      </div>

      {/* daily engine */}
      <div className="card space-y-4">
        <h3 className="font-display text-sm font-semibold text-primary">Daily engine</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Daily quota" hint="Actions per day (new + follow-ups).">
            <Input type="number" min="1" max="50" value={form.daily_quota} onChange={set('daily_quota')} />
          </Field>
          <Field label="Follow-up after (days)" hint="Default for new targets.">
            <Input type="number" min="1" max="60" value={form.followup_days} onChange={set('followup_days')} />
          </Field>
        </div>
      </div>

      {/* pivot thresholds */}
      <div className="card space-y-4">
        <h3 className="font-display text-sm font-semibold text-primary">Decision framework</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Pivot after (contacts)">
            <Input type="number" min="1" value={form.pivot_after_contacts} onChange={set('pivot_after_contacts')} />
          </Field>
          <Field label="Min response rate (%)">
            <Input type="number" min="0" max="100" value={form.pivot_min_rate} onChange={set('pivot_min_rate')} />
          </Field>
          <Field label="Check every (contacts)">
            <Input type="number" min="1" value={form.pivot_check_interval} onChange={set('pivot_check_interval')} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          You'll get a pivot alert once you pass <span className="text-secondary">{form.pivot_after_contacts}</span> contacts with a response rate under{' '}
          <span className="text-secondary">{form.pivot_min_rate}%</span>, plus a reflection prompt every{' '}
          <span className="text-secondary">{form.pivot_check_interval}</span> contacts.
        </p>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}><Save size={16} /> Save settings</Button>
        </div>
      </div>

      {/* data */}
      <div className="card space-y-3">
        <h3 className="font-display text-sm font-semibold text-primary">Your data</h3>
        <p className="text-sm text-secondary">Export everything as CSV — targets, responses, learnings, and message iterations. You're never locked in.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportAll}><Download size={16} /> Export all data</Button>
          <Button variant="danger" onClick={reset} disabled={busy}><RotateCcw size={16} /> Reset to sample data</Button>
        </div>
      </div>
    </div>
  )
}

const clamp = (v, lo, hi) => Math.min(Math.max(Number(v) || lo, lo), hi)
