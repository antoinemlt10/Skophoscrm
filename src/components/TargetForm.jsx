// ============================================================
// Add / edit a single target. Used from Targets, Pipeline and Scheduler.
// ============================================================
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Button, Field, Input, Textarea, Select } from './ui.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { CHANNELS, PRIORITIES, DAYS, STAGES } from '../lib/constants.js'
import { addDays, toDayKey } from '../lib/date.js'

const BLANK = {
  name: '', email: '', department: '', lab: '', research_area: '', hook: '',
  channel: 'Email', priority: 'Medium', scheduled_day: '', followup_days: 5,
  status: 'Prospect', notes: '',
}

export default function TargetForm({ open, onClose, target = null }) {
  const { addTarget, updateTarget, settings } = useData()
  const toast = useToast()
  const editing = Boolean(target)
  const [form, setForm] = useState(() => ({ ...BLANK, ...stripNulls(target) }))
  const [busy, setBusy] = useState(false)

  // Re-seed the form every time the modal opens (covers Add → Cancel → Add,
  // where the target id stays null) or when a different target is opened.
  useEffect(() => {
    if (open) setForm({ ...BLANK, ...stripNulls(target) })
  }, [open, target?.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast('Give your target a name', 'error')
    setBusy(true)
    try {
      // followup_days: always a positive integer (fall back to the global default).
      const parsed = parseInt(form.followup_days, 10)
      const followup_days = Number.isFinite(parsed) && parsed > 0 ? parsed : settings.followup_days || 5
      // Only (re)compute the follow-up date when there's a contact date to base it on;
      // with no contact date it stays null (Postgres rejects '' for date columns).
      const base = form.last_contact_date || null
      const next_followup_date = base ? addDays(toDayKey(base), followup_days) : null

      const payload = {
        ...form,
        followup_days,
        scheduled_day: form.scheduled_day || null,
        next_followup_date,
      }
      if (editing) {
        await updateTarget(target.id, payload)
        toast('Target updated')
      } else {
        await addTarget(payload)
        toast(`${form.name.split(' ')[0]} added to your pipeline`)
      }
      onClose()
    } catch (err) {
      toast(err.message || 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit target' : 'Add a target'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button onClick={submit} disabled={busy}>{editing ? 'Save changes' : 'Add target'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={form.name} onChange={set('name')} placeholder="Dr. Lena Ortiz" autoFocus />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="lortiz@berkeley.edu" />
        </Field>
        <Field label="Department">
          <Input value={form.department} onChange={set('department')} placeholder="Neuroscience" />
        </Field>
        <Field label="Lab">
          <Input value={form.lab} onChange={set('lab')} placeholder="Helen Wills Neuroscience Institute" />
        </Field>
        <Field label="Research area">
          <Input value={form.research_area} onChange={set('research_area')} placeholder="Memory & hippocampal circuits" />
        </Field>
        <Field label="Personalization hook" className="sm:col-span-2" hint="Merged into [Hook]. Make it specific — this is what earns the reply.">
          <Input value={form.hook} onChange={set('hook')} placeholder="your recent work on hippocampal replay during sleep" />
        </Field>

        <Field label="Channel">
          <Select value={form.channel} onChange={set('channel')}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Scheduled day" hint="Which day to first reach out.">
          <Select value={form.scheduled_day} onChange={set('scheduled_day')}>
            <option value="">Unscheduled</option>
            {DAYS.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Follow-up after (days)">
          <Input type="number" min="1" max="60" value={form.followup_days} onChange={set('followup_days')} />
        </Field>

        {editing && (
          <Field label="Status" className="sm:col-span-2">
            <Select value={form.status} onChange={set('status')}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Met at the BioE mixer; mentioned she hates managing alerts…" />
        </Field>
      </form>
    </Modal>
  )
}

function stripNulls(obj) {
  if (!obj) return {}
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[k] = v == null ? '' : v
  return out
}
