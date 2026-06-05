// ============================================================
// LEARNINGS — your founder's notebook. Log observations, convictions,
// and pivot decisions over time so your hypothesis evolves on the record.
// ============================================================
import { useState } from 'react'
import { Lightbulb, Trash2, Download, Plus, Compass, Eye, Flag } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Badge, Textarea, Select, SectionTitle, EmptyState, cx } from '../components/ui.jsx'
import { toCSV, downloadFile } from '../lib/csv.js'
import { shortDate } from '../lib/date.js'

const KINDS = [
  { key: 'observation', label: 'Observation', icon: Eye, tone: 'info' },
  { key: 'conviction', label: 'Conviction', icon: Compass, tone: 'accent' },
  { key: 'pivot', label: 'Pivot', icon: Flag, tone: 'streak' },
]
const META = Object.fromEntries(KINDS.map((k) => [k.key, k]))

// Static class maps (Tailwind can't see dynamically-built class names).
const CHIP_ACTIVE = {
  info: 'border-info/40 bg-info/10 text-info',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  streak: 'border-streak/40 bg-streak/10 text-streak',
}
const ICON_WRAP = {
  info: 'bg-info/12 text-info',
  accent: 'bg-accent/12 text-accent',
  streak: 'bg-streak/12 text-streak',
}

export default function Learnings() {
  const { learnings, addLearning, deleteLearning } = useData()
  const toast = useToast()
  const [kind, setKind] = useState('observation')
  const [content, setContent] = useState('')
  const [filter, setFilter] = useState('all')

  const add = async () => {
    if (!content.trim()) return toast('Write something first', 'error')
    await addLearning(kind, content.trim())
    toast('Logged')
    setContent('')
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    await deleteLearning(id)
  }

  const exportCSV = () => {
    if (!learnings.length) return toast('Nothing to export yet', 'error')
    const cols = [
      { label: 'Type', get: (l) => l.kind },
      { label: 'Content', get: (l) => l.content },
      { label: 'Date', get: (l) => l.created_at },
    ]
    downloadFile('skophos-learnings.csv', toCSV(learnings, cols))
    toast('Exported learnings')
  }

  const rows = [...learnings]
    .filter((l) => filter === 'all' || l.kind === filter)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Learnings"
        subtitle="What changed your mind, and when."
        action={<Button variant="secondary" size="sm" onClick={exportCSV}><Download size={15} /> <span className="hidden sm:inline">Export</span></Button>}
      />

      {/* composer */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className={cx('inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all', kind === k.key ? CHIP_ACTIVE[k.tone] : 'border-border-default text-secondary hover:text-primary')}
            >
              <k.icon size={14} /> {k.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. Neuro replies 3x more than Chemistry — lead with a specific recent paper, not the product." className="flex-1" />
          <Button onClick={add} className="self-stretch"><Plus size={16} /></Button>
        </div>
      </div>

      {/* filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-44 py-0 text-sm">
          <option value="all">All entries</option>
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </Select>
        <span className="text-xs text-muted">{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Nothing logged yet" message="Every 20 contacts, the pivot check will nudge you here. You can also jot a thought anytime." />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((l) => {
            const m = META[l.kind] || META.observation
            return (
              <li key={l.id} className="card flex items-start gap-3 p-4">
                <span className={cx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', ICON_WRAP[m.tone])}>
                  <m.icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={m.tone}>{m.label}</Badge>
                    <span className="text-xs text-muted">{shortDate(l.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-secondary">{l.content}</p>
                </div>
                <button onClick={() => remove(l.id)} className="shrink-0 text-muted transition-colors hover:text-danger" aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
