// ============================================================
// PIPELINE — Kanban (drag & drop) + Table view of every target.
// Overdue follow-ups are surfaced up top. Click any card for the full
// history, last message sent, and reply capture.
// ============================================================
import { useMemo, useState } from 'react'
import {
  KanbanSquare, Table2, AlertTriangle, Clock, Pencil, Reply, GripVertical,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCelebration } from '../components/Celebration.jsx'
import { Button, Badge, Select, SectionTitle, cx } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import TargetForm from '../components/TargetForm.jsx'
import ResponseModal from '../components/ResponseModal.jsx'
import { STAGES, STAGE_META } from '../lib/constants.js'
import { relativeDay, shortDate, isOverdue } from '../lib/date.js'

export default function Pipeline() {
  const { targets } = useData()
  const [view, setView] = useState('board')
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const { celebrateWin } = useCelebration()

  const overdue = useMemo(
    () => targets.filter((t) => t.status === 'Contacted' && isOverdue(t.next_followup_date)),
    [targets]
  )

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Pipeline"
        subtitle={`${targets.length} targets across ${STAGES.length} stages`}
        action={
          <div className="flex rounded-md border border-border-default bg-base p-0.5">
            <ToggleBtn active={view === 'board'} onClick={() => setView('board')} icon={KanbanSquare}>Board</ToggleBtn>
            <ToggleBtn active={view === 'table'} onClick={() => setView('table')} icon={Table2}>Table</ToggleBtn>
          </div>
        }
      />

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-danger" />
          <p className="flex-1 text-sm text-secondary">
            <span className="font-semibold text-primary">{overdue.length} follow-up{overdue.length > 1 ? 's' : ''} overdue.</span>{' '}
            They're waiting in your Today queue — the longer the gap, the colder the lead.
          </p>
        </div>
      )}

      {view === 'board' ? (
        <Board targets={targets} onOpen={setDetail} />
      ) : (
        <PipelineTable targets={targets} onOpen={setDetail} />
      )}

      <TargetDetail
        target={detail}
        onClose={() => setDetail(null)}
        onEdit={(t) => { setDetail(null); setEditing(t) }}
        onReply={(t) => { setDetail(null); setReplyTo(t) }}
      />
      <TargetForm open={editing != null} onClose={() => setEditing(null)} target={editing} />
      <ResponseModal open={replyTo != null} onClose={() => setReplyTo(null)} target={replyTo} onWin={celebrateWin} />
    </div>
  )
}

function ToggleBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={cx('inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors', active ? 'bg-elevated text-primary' : 'text-muted hover:text-secondary')}
    >
      <Icon size={15} /> {children}
    </button>
  )
}

/* ── Kanban board ─────────────────────────────────────────────── */
function Board({ targets, onOpen }) {
  const { moveStage } = useData()
  const toast = useToast()
  const { celebrateOnboard } = useCelebration()
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)

  const byStage = (stage) => targets.filter((t) => t.status === stage)

  const onDrop = async (stage) => {
    const t = targets.find((x) => x.id === dragId)
    setDragId(null)
    setOverStage(null)
    if (!t || t.status === stage) return
    await moveStage(t, stage)
    // Reaching "Onboarded" is the real Phase 0 win — celebrate instead of toast.
    if (stage === 'Onboarded') celebrateOnboard(t)
    else toast(`${t.name.split(' ')[0]} → ${stage}`)
  }

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {STAGES.map((stage) => {
        const list = byStage(stage)
        const meta = STAGE_META[stage]
        return (
          <div
            key={stage}
            onDragOver={(e) => { e.preventDefault(); setOverStage(stage) }}
            onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
            onDrop={() => onDrop(stage)}
            className={cx(
              'flex w-72 shrink-0 snap-start flex-col rounded-lg border bg-surface/60 transition-colors',
              overStage === stage ? 'border-accent/50 bg-accent/5' : 'border-border-subtle'
            )}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={cx('h-2 w-2 rounded-full', `bg-${meta.color}`)} />
                <span className="text-sm font-semibold text-primary">{stage}</span>
              </div>
              <span className="tnum rounded-full bg-elevated px-2 text-xs font-medium text-muted">{list.length}</span>
            </div>
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
              {list.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted">{meta.hint}</p>}
              {list.map((t) => (
                <KanbanCard key={t.id} target={t} onOpen={onOpen} onDragStart={() => setDragId(t.id)} dragging={dragId === t.id} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ target, onOpen, onDragStart, dragging }) {
  const overdueFollow = target.status === 'Contacted' && isOverdue(target.next_followup_date)
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpen(target)}
      className={cx(
        'group cursor-pointer rounded-md border border-border-subtle bg-elevated/70 p-3 transition-all hover:border-border-strong hover:bg-elevated',
        dragging && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{target.name}</p>
          <p className="truncate text-xs text-muted">{[target.department, target.lab].filter(Boolean).join(' · ') || '—'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={target.channel === 'LinkedIn' ? 'info' : 'muted'}>{target.channel}</Badge>
            {overdueFollow ? (
              <Badge tone="danger"><Clock size={11} /> {relativeDay(target.next_followup_date)}</Badge>
            ) : target.status === 'Contacted' && target.next_followup_date ? (
              <Badge tone="streak">{relativeDay(target.next_followup_date)}</Badge>
            ) : null}
            {target.response_type && <Badge tone={target.response_type === 'Interested' ? 'success' : 'muted'}>{target.response_type}</Badge>}
          </div>
        </div>
      </div>
    </article>
  )
}

/* ── Table view ───────────────────────────────────────────────── */
function PipelineTable({ targets, onOpen }) {
  const { moveStage } = useData()
  const toast = useToast()
  const { celebrateOnboard } = useCelebration()

  const changeStage = async (t, stage) => {
    if (t.status === stage) return
    await moveStage(t, stage)
    if (stage === 'Onboarded') celebrateOnboard(t)
    else toast(`${t.name.split(' ')[0]} → ${stage}`)
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Department</th>
            <th className="px-4 py-2.5 font-medium">Stage</th>
            <th className="px-4 py-2.5 font-medium">Last contact</th>
            <th className="px-4 py-2.5 font-medium">Follow-up</th>
            <th className="px-4 py-2.5 font-medium">Reply</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {targets.map((t) => (
            <tr key={t.id} className="transition-colors hover:bg-elevated/40">
              <td className="px-4 py-2.5">
                <button onClick={() => onOpen(t)} className="font-medium text-primary hover:text-accent">{t.name}</button>
              </td>
              <td className="px-4 py-2.5 text-secondary">{t.department || '—'}</td>
              <td className="px-4 py-2.5">
                <Select value={t.status} onChange={(e) => changeStage(t, e.target.value)} className="h-8 py-0 text-xs">
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </td>
              <td className="px-4 py-2.5 text-secondary">{shortDate(t.last_contact_date)}</td>
              <td className={cx('px-4 py-2.5', t.status === 'Contacted' && isOverdue(t.next_followup_date) ? 'text-danger' : 'text-secondary')}>
                {t.status === 'Contacted' && t.next_followup_date ? relativeDay(t.next_followup_date) : '—'}
              </td>
              <td className="px-4 py-2.5">{t.response_type ? <Badge tone={t.response_type === 'Interested' ? 'success' : 'muted'}>{t.response_type}</Badge> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Target detail drawer ─────────────────────────────────────── */
function TargetDetail({ target, onClose, onEdit, onReply }) {
  const { transitions } = useData()
  if (!target) return null
  const history = transitions
    .filter((tr) => tr.target_id === target.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const tone = STAGE_META[target.status]?.color || 'muted'

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={target.name}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onEdit(target)}><Pencil size={15} /> Edit</Button>
          <Button onClick={() => onReply(target)}><Reply size={15} /> Log reply</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone} dot>{target.status}</Badge>
          <Badge tone={target.channel === 'LinkedIn' ? 'info' : 'muted'}>{target.channel}</Badge>
          <Badge tone={target.priority === 'High' ? 'danger' : 'muted'}>{target.priority} priority</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Detail label="Email" value={target.email} />
          <Detail label="Department" value={target.department} />
          <Detail label="Lab" value={target.lab} />
          <Detail label="Research area" value={target.research_area} />
          <Detail label="Last contact" value={shortDate(target.last_contact_date)} />
          <Detail label="Follow-up due" value={target.next_followup_date ? relativeDay(target.next_followup_date) : '—'} />
        </dl>

        {target.hook && (
          <Block label="Personalization hook"><p className="text-sm italic text-primary">“{target.hook}”</p></Block>
        )}

        {target.response_type && (
          <Block label="Their reply">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={target.response_type === 'Interested' ? 'success' : 'muted'}>{target.response_type}</Badge>
              {target.response_sentiment && <Badge tone={target.response_sentiment === 'Positive' ? 'success' : target.response_sentiment === 'Negative' ? 'danger' : 'info'}>{target.response_sentiment}</Badge>}
            </div>
            {target.response_quote && <p className="mt-2 text-sm italic text-secondary">“{target.response_quote}”</p>}
          </Block>
        )}

        {target.last_message_text && (
          <Block label="Last message sent">
            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-base p-3 font-sans text-sm leading-relaxed text-secondary">{target.last_message_text}</pre>
          </Block>
        )}

        {target.notes && <Block label="Notes"><p className="text-sm text-secondary">{target.notes}</p></Block>}

        <Block label="History">
          {history.length === 0 ? (
            <p className="text-sm text-muted">No stage changes logged yet.</p>
          ) : (
            <ol className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-secondary">{h.from_status ? `${h.from_status} → ` : ''}<span className="font-medium text-primary">{h.to_status}</span></span>
                  <span className="ml-auto text-xs text-muted">{shortDate(h.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </Block>
      </div>
    </Modal>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-primary">{value || '—'}</dd>
    </div>
  )
}
function Block({ label, children }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      {children}
    </div>
  )
}
