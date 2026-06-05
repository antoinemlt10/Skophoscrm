// ============================================================
// TODAY — the cockpit. Quota ring + streak, then the exact list of
// people to contact today, each with one-click copy / open / mark-sent.
// This is the screen that should make sending feel effortless.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import {
  Flame, Copy, Check, Send, Mail, ExternalLink, ChevronDown, Sparkles, Minus, Plus, CalendarPlus, Reply,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCelebration } from '../components/Celebration.jsx'
import { Button, Badge, ProgressRing, ProgressBar, EmptyState, cx } from '../components/ui.jsx'
import { mergeTemplate } from '../lib/merge.js'
import { relativeDay } from '../lib/date.js'
import { STAGE_META } from '../lib/constants.js'
import PivotBanner from '../components/PivotBanner.jsx'
import ResponseModal from '../components/ResponseModal.jsx'

export default function Dashboard() {
  const data = useData()
  const { doneToday, quota, streak, todayQueue, templates, updateSettings } = data
  const { celebrateQuota, celebrateWin } = useCelebration()
  const toast = useToast()
  const [respTarget, setRespTarget] = useState(null)

  // Fire the quota celebration exactly once, the moment we cross the line.
  const prevDone = useRef(doneToday)
  useEffect(() => {
    if (prevDone.current < quota && doneToday >= quota && quota > 0) {
      celebrateQuota()
      toast(`Quota smashed — ${doneToday}/${quota} done today 🔥`, 'success')
    }
    prevDone.current = doneToday
  }, [doneToday, quota, celebrateQuota, toast])

  // Build today's ordered action list: overdue follow-ups first, then first contacts.
  const queue = [
    ...todayQueue.followups.map((t) => ({ target: t, kind: 'followup' })),
    ...todayQueue.firstContacts.map((t) => ({ target: t, kind: 'first_contact' })),
  ]
  const remaining = queue.length
  const complete = doneToday >= quota
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const setQuota = (n) => updateSettings({ daily_quota: Math.max(1, n) })

  return (
    <div className="space-y-6">
      <PivotBanner />

      {/* ── Hero: quota + streak ─────────────────────────────── */}
      <section className="card overflow-hidden p-0">
        <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8 sm:p-8">
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: 'radial-gradient(40% 60% at 18% 20%, rgb(var(--accent)/0.10), transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative shrink-0">
            <ProgressRing value={doneToday} max={quota} size={148}>
              <div className="tnum font-display text-4xl font-bold leading-none text-primary">
                {doneToday}
                <span className="text-xl text-muted">/{quota}</span>
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted">done today</div>
            </ProgressRing>
          </div>

          <div className="relative flex-1 text-center sm:text-left">
            <p className="text-sm text-secondary">{greeting}, Antoine.</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {complete ? "Today's quota is done. 🎯" : remaining > 0 ? `${remaining} ${remaining === 1 ? 'person' : 'people'} to reach today` : 'Nothing scheduled for today'}
            </h2>
            <p className="mt-1.5 text-sm text-secondary">
              {complete
                ? 'You showed up. That consistency is the whole game — see you tomorrow.'
                : "Send first, perfect later. Each one takes about a minute."}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <ProgressBar value={doneToday} max={quota} tone={complete ? 'success' : 'accent'} />
              </div>
              {/* quota stepper */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Daily goal</span>
                <div className="flex items-center rounded-md border border-border-default bg-base">
                  <button onClick={() => setQuota(quota - 1)} className="grid h-8 w-8 place-items-center text-muted hover:text-primary" aria-label="Lower goal">
                    <Minus size={14} />
                  </button>
                  <span className="tnum w-7 text-center text-sm font-semibold text-primary">{quota}</span>
                  <button onClick={() => setQuota(quota + 1)} className="grid h-8 w-8 place-items-center text-muted hover:text-primary" aria-label="Raise goal">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {streak > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-streak/25 bg-streak/10 px-3 py-1 text-sm">
                <Flame size={15} className="animate-flame text-streak" fill="currentColor" />
                <span className="font-semibold text-streak">{streak}-day streak</span>
                <span className="text-muted">— don't break the chain</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── The queue ────────────────────────────────────────── */}
      {queue.length > 0 ? (
        <section className="space-y-3">
          {queue.map(({ target, kind }) => (
            <ActionCard key={target.id} target={target} kind={kind} templates={templates} onLogReply={() => setRespTarget(target)} />
          ))}
        </section>
      ) : (
        <DonePanel unscheduled={todayQueue.unscheduled} />
      )}

      <ResponseModal open={Boolean(respTarget)} onClose={() => setRespTarget(null)} target={respTarget} onWin={celebrateWin} />
    </div>
  )
}

/* ── A single action card ─────────────────────────────────────── */
function ActionCard({ target, kind, templates, onLogReply }) {
  const { markAsSent } = useData()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isFollowup = kind === 'followup'
  const template = templates.find((t) => t.key === (isFollowup ? 'followup_bump' : 'first_contact')) || templates[0]
  const merged = mergeTemplate(template, target)
  const stageColor = STAGE_META[target.status]?.color || 'muted'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(merged.body)
      setCopied(true)
      toast('Email copied — go paste & send')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast('Copy failed — select the preview text instead', 'error')
    }
  }

  const mailto = () => {
    const url = `mailto:${encodeURIComponent(target.email || '')}?subject=${encodeURIComponent(merged.subject)}&body=${encodeURIComponent(merged.body)}`
    // location.href hands the URL to the OS mail client without a stray blank tab.
    window.location.href = url
  }

  const markSent = async () => {
    setSent(true) // optimistic visual; card will drop from queue on next render
    try {
      await markAsSent(target, {
        templateKey: template?.key,
        templateVersion: template?.version,
        messageText: merged.body,
        actionType: isFollowup ? 'followup' : 'first_contact',
      })
      toast(`Marked ${target.name.split(' ')[0]} as ${isFollowup ? 'followed up' : 'contacted'}`)
    } catch (e) {
      setSent(false)
      toast(e.message || 'Could not update', 'error')
    }
  }

  return (
    <article className={cx('card p-4 transition-all sm:p-5', sent && 'pointer-events-none scale-[0.98] opacity-40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-primary">{target.name}</h3>
            <Badge tone={isFollowup ? 'streak' : 'accent'} dot>
              {isFollowup ? `Follow-up · ${relativeDay(target.next_followup_date)}` : 'First contact'}
            </Badge>
            {target.priority === 'High' && <Badge tone="danger">High</Badge>}
          </div>
          <p className="mt-1 truncate text-sm text-secondary">
            {[target.department, target.lab].filter(Boolean).join(' · ') || 'No department set'}
          </p>
          {target.hook && <p className="mt-1 truncate text-xs italic text-muted">“{target.hook}”</p>}
        </div>
        <Badge tone={target.channel === 'LinkedIn' ? 'info' : 'muted'}>{target.channel}</Badge>
      </div>

      {/* preview toggle */}
      <button
        onClick={() => setShowPreview((s) => !s)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-secondary"
      >
        <ChevronDown size={14} className={cx('transition-transform', showPreview && 'rotate-180')} />
        {showPreview ? 'Hide' : 'Preview'} message ({template?.name})
      </button>
      {showPreview && (
        <div className="mt-2 rounded-md border border-border-subtle bg-base p-3 animate-fade-in">
          {merged.subject && <p className="mb-2 text-xs font-semibold text-secondary">Subject: {merged.subject}</p>}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-primary">{merged.body}</pre>
        </div>
      )}

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy email'}
        </Button>
        {target.channel === 'Email' && target.email && (
          <Button size="sm" variant="ghost" onClick={mailto}>
            <Mail size={15} /> Open <ExternalLink size={13} />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onLogReply} title="They replied?">
            <Reply size={15} /> <span className="hidden sm:inline">Got a reply</span>
          </Button>
          <Button size="sm" onClick={markSent}>
            <Send size={15} /> Mark as sent
          </Button>
        </div>
      </div>
    </article>
  )
}

/* ── Shown when the day's queue is clear ──────────────────────── */
function DonePanel({ unscheduled }) {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={Sparkles}
        title="Outreach inbox zero"
        message="Nothing is scheduled for today. Enjoy the dopamine — or get ahead by pulling from your backlog below."
      />
      {unscheduled.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <CalendarPlus size={16} className="text-accent" /> Get ahead — {unscheduled.length} unscheduled prospect{unscheduled.length > 1 ? 's' : ''}
          </div>
          <ul className="divide-y divide-border-subtle">
            {unscheduled.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary">{t.name}</p>
                  <p className="truncate text-xs text-muted">{[t.department, t.lab].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge tone={t.priority === 'High' ? 'danger' : 'muted'}>{t.priority}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Tip: assign them a day in the Scheduler so they show up here automatically.</p>
        </div>
      )}
    </div>
  )
}
