// ============================================================
// SCHEDULER — assign first-contact prospects to days of the week.
// Drag cards between days (or the backlog) to reschedule. Whatever lands
// on today's column shows up in the Today dashboard automatically.
// ============================================================
import { useState } from 'react'
import { CalendarDays, Inbox, Info } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Badge, Select, SectionTitle, EmptyState, cx } from '../components/ui.jsx'
import { DAYS } from '../lib/constants.js'
import { todayWeekday } from '../lib/date.js'

export default function Scheduler() {
  const { targets, updateTarget } = useData()
  const toast = useToast()
  const [dragId, setDragId] = useState(null)
  const [over, setOver] = useState(null)
  const today = todayWeekday()

  // Only un-contacted prospects are schedulable (scheduling = planning first contact).
  const prospects = targets.filter((t) => t.status === 'Prospect')
  const backlog = prospects.filter((t) => !t.scheduled_day)
  const forDay = (d) => prospects.filter((t) => t.scheduled_day === d)

  const drop = async (day) => {
    const t = prospects.find((x) => x.id === dragId)
    setDragId(null)
    setOver(null)
    if (!t || t.scheduled_day === day) return
    await updateTarget(t.id, { scheduled_day: day })
    toast(day ? `${t.name.split(' ')[0]} → ${day}` : `${t.name.split(' ')[0]} → backlog`)
  }

  if (prospects.length === 0) {
    return (
      <div className="space-y-5">
        <SectionTitle title="Scheduler" subtitle="Plan your week of first contacts." />
        <EmptyState icon={CalendarDays} title="No prospects to schedule" message="Every prospect has been contacted. Add more targets to plan next week." />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SectionTitle title="Scheduler" subtitle="Drag prospects onto a day. Today's column feeds your dashboard." />

      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-elevated/40 px-3 py-2 text-xs text-muted">
        <Info size={14} /> {backlog.length} in backlog · {prospects.length - backlog.length} scheduled this week
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Backlog */}
        <DayColumn
          label="Backlog"
          icon={Inbox}
          items={backlog}
          isOver={over === ''}
          onDragOver={() => setOver('')}
          onDrop={() => drop(null)}
          dragId={dragId}
          setDragId={setDragId}
        />
        {/* Days */}
        {DAYS.map((d) => (
          <DayColumn
            key={d}
            label={d}
            isToday={d === today}
            items={forDay(d)}
            isOver={over === d}
            onDragOver={() => setOver(d)}
            onDrop={() => drop(d)}
            dragId={dragId}
            setDragId={setDragId}
          />
        ))}
      </div>
    </div>
  )
}

function DayColumn({ label, icon: Icon, items, isToday, isOver, onDragOver, onDrop, dragId, setDragId }) {
  const { updateTarget } = useData()
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDrop={onDrop}
      className={cx(
        'flex min-h-[140px] flex-col rounded-lg border bg-surface/60 transition-colors',
        isOver ? 'border-accent/50 bg-accent/5' : isToday ? 'border-accent/30' : 'border-border-subtle'
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={14} className="text-muted" />}
          <span className={cx('text-sm font-semibold', isToday ? 'text-accent' : 'text-primary')}>{label}</span>
          {isToday && <Badge tone="accent">Today</Badge>}
        </div>
        <span className="tnum rounded-full bg-elevated px-2 text-xs text-muted">{items.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">Drop prospects here</p>}
        {items.map((t) => (
          <article
            key={t.id}
            draggable
            onDragStart={() => setDragId(t.id)}
            className={cx('cursor-grab rounded-md border border-border-subtle bg-elevated/70 p-2.5 transition-all hover:border-border-strong active:cursor-grabbing', dragId === t.id && 'opacity-40')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-primary">{t.name}</span>
              {t.priority === 'High' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" title="High priority" />}
            </div>
            <p className="truncate text-xs text-muted">{t.department || '—'}</p>
            {/* Touch-friendly fallback: assign a day without dragging. */}
            <Select
              value={t.scheduled_day || ''}
              onChange={(e) => updateTarget(t.id, { scheduled_day: e.target.value || null })}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 h-7 py-0 text-xs"
              aria-label={`Schedule ${t.name}`}
            >
              <option value="">Backlog</option>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </article>
        ))}
      </div>
    </div>
  )
}
