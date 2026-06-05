// ============================================================
// TARGETS — manage everyone in the pipeline. Search, filter, add, edit,
// delete, bulk-import via CSV paste, and export.
// ============================================================
import { useMemo, useState } from 'react'
import { Plus, Search, Upload, Download, Pencil, Trash2, Users } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Badge, Input, Select, EmptyState, SectionTitle, cx } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import TargetForm from '../components/TargetForm.jsx'
import { STAGES, STAGE_META } from '../lib/constants.js'
import { relativeDay } from '../lib/date.js'
import { parseCSV, rowsToTargets, toCSV, downloadFile } from '../lib/csv.js'

export default function Targets() {
  const { targets, deleteTarget } = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('All')
  const [dept, setDept] = useState('All')
  const [editing, setEditing] = useState(null) // target or 'new'
  const [importing, setImporting] = useState(false)

  const departments = useMemo(
    () => ['All', ...[...new Set(targets.map((t) => t.department).filter(Boolean))].sort()],
    [targets]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return targets.filter((t) => {
      if (status !== 'All' && t.status !== status) return false
      if (dept !== 'All' && t.department !== dept) return false
      if (!needle) return true
      return [t.name, t.email, t.department, t.lab, t.research_area, t.hook]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(needle))
    })
  }, [targets, q, status, dept])

  const exportCSV = () => {
    const cols = [
      { label: 'Name', get: (t) => t.name },
      { label: 'Email', get: (t) => t.email },
      { label: 'Department', get: (t) => t.department },
      { label: 'Lab', get: (t) => t.lab },
      { label: 'Research area', get: (t) => t.research_area },
      { label: 'Hook', get: (t) => t.hook },
      { label: 'Channel', get: (t) => t.channel },
      { label: 'Priority', get: (t) => t.priority },
      { label: 'Status', get: (t) => t.status },
      { label: 'Last contact', get: (t) => t.last_contact_date },
      { label: 'Next follow-up', get: (t) => t.next_followup_date },
      { label: 'Response type', get: (t) => t.response_type },
      { label: 'Sentiment', get: (t) => t.response_sentiment },
      { label: 'Response quote', get: (t) => t.response_quote },
      { label: 'Notes', get: (t) => t.notes },
    ]
    downloadFile(`skophos-targets-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(targets, cols))
    toast('Exported targets CSV')
  }

  const remove = async (t) => {
    if (!window.confirm(`Delete ${t.name}? This can't be undone.`)) return
    await deleteTarget(t.id)
    toast(`${t.name.split(' ')[0]} deleted`)
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Targets"
        subtitle={`${targets.length} in your pipeline`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)}><Upload size={15} /> <span className="hidden sm:inline">Import</span></Button>
            <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={15} /> <span className="hidden sm:inline">Export</span></Button>
            <Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Add</Button>
          </div>
        }
      />

      {/* filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, lab, hook…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
          <option>All</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-52">
          {departments.map((d) => <option key={d}>{d}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={targets.length === 0 ? 'No targets yet' : 'No matches'}
          message={targets.length === 0 ? 'Add your first researcher or paste a batch list to get started.' : 'Try a different search or filter.'}
          action={targets.length === 0 && <Button onClick={() => setEditing('new')}><Plus size={16} /> Add a target</Button>}
        />
      ) : (
        <TargetTable rows={filtered} onEdit={setEditing} onDelete={remove} />
      )}

      <TargetForm open={editing != null} onClose={() => setEditing(null)} target={editing === 'new' ? null : editing} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

/* ── Table (cards on mobile, grid rows on desktop) ────────────── */
function TargetTable({ rows, onEdit, onDelete }) {
  return (
    <div className="card overflow-hidden p-0">
      {/* desktop header */}
      <div className="hidden grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.9fr_auto] gap-3 border-b border-border-subtle px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted lg:grid">
        <span>Name</span><span>Department / Lab</span><span>Channel</span><span>Status</span><span>Follow-up</span><span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-border-subtle">
        {rows.map((t) => {
          const tone = STAGE_META[t.status]?.color || 'muted'
          return (
            <li key={t.id} className="grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-elevated/40 lg:grid-cols-[1.6fr_1.4fr_0.8fr_0.9fr_0.9fr_auto] lg:items-center lg:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-primary">{t.name}</span>
                  {t.priority === 'High' && <Badge tone="danger">High</Badge>}
                </div>
                {t.email && <span className="truncate text-xs text-muted">{t.email}</span>}
              </div>
              <div className="min-w-0 text-sm text-secondary">
                <span className="truncate">{[t.department, t.lab].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              <div><Badge tone={t.channel === 'LinkedIn' ? 'info' : 'muted'}>{t.channel}</Badge></div>
              <div><Badge tone={tone} dot>{t.status}</Badge></div>
              <div className="text-sm text-secondary">
                {t.status === 'Contacted' && t.next_followup_date ? relativeDay(t.next_followup_date) : '—'}
              </div>
              <div className="flex items-center gap-1 lg:justify-end">
                <button onClick={() => onEdit(t)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-primary" aria-label={`Edit ${t.name}`}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(t)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-danger" aria-label={`Delete ${t.name}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Bulk import via CSV paste ─────────────────────────────────── */
function ImportModal({ open, onClose }) {
  const { addTargets } = useData()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => (text.trim() ? rowsToTargets(parseCSV(text)) : []), [text])

  const doImport = async () => {
    if (!preview.length) return toast('Nothing to import — check your format', 'error')
    setBusy(true)
    try {
      const { inserted, skipped } = await addTargets(preview)
      const dupPart = skipped > 0 ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''
      toast(`Imported ${inserted} new${dupPart}`, inserted > 0 ? 'success' : 'info')
      setText('')
      onClose()
    } catch (e) {
      toast(e.message || 'Import failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import targets"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={doImport} disabled={busy || !preview.length}>Import {preview.length || ''}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-secondary">
          Paste rows as <span className="font-mono text-primary">Name, Email, Department, Lab, Research area, Hook</span>.
          A header row is optional — we'll detect it. One target per line.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          className="input-base resize-y font-mono text-xs leading-relaxed"
          placeholder={'Dr. Lena Ortiz, lortiz@berkeley.edu, Neuroscience, Helen Wills, Memory circuits, your replay-during-sleep work\nMarcus Feng, mfeng@berkeley.edu, Bioengineering, Healy Lab, Organ-on-chip, your microfluidics platform'}
        />
        {preview.length > 0 && (
          <div className="rounded-md border border-border-subtle bg-base p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Preview — {preview.length} target{preview.length > 1 ? 's' : ''}</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {preview.slice(0, 8).map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-primary">{t.name}</span>
                  <span className="text-muted">{[t.department, t.email].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
              {preview.length > 8 && <li className="text-xs text-muted">…and {preview.length - 8} more</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
