// ============================================================
// Decision framework: a baseline-check alert + a recurring "pivot check"
// prompt every N contacts. Logged reflections are saved as learnings.
// ============================================================
import { useState } from 'react'
import { AlertTriangle, Compass, ChevronRight, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Textarea, cx } from './ui.jsx'
import { PIVOT_CHECKLIST } from '../lib/constants.js'

const SEEN_KEY = 'skophos.pivotSeen'
const BASELINE_KEY = 'skophos.baselineDismissedAt'

const getSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
const addSeen = (n) => {
  const s = getSeen()
  s.add(n)
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s]))
}
// Baseline alert is dismissed "at N contacts"; it only returns once you've
// reached another full interval of contacts (so it nags meaningfully, not constantly).
const getBaselineDismissed = () => {
  const v = Number(localStorage.getItem(BASELINE_KEY))
  return Number.isFinite(v) && v > 0 ? v : null
}
const setBaselineDismissed = (n) => localStorage.setItem(BASELINE_KEY, String(n))

export default function PivotBanner() {
  const { stats, settings, addLearning } = useData()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reflection, setReflection] = useState('')
  const [, force] = useState(0)

  const reached = stats.reachedCount
  const interval = settings.pivot_check_interval || 20

  // Baseline pivot alert — past the threshold AND under the minimum rate.
  const baselineFail =
    reached >= (settings.pivot_after_contacts || 50) && stats.responseRate < (settings.pivot_min_rate || 5)
  const baselineDismissedAt = getBaselineDismissed()
  const baselineActive = baselineFail && (baselineDismissedAt == null || reached >= baselineDismissedAt + interval)

  // Recurring check — at each multiple of `interval`, once.
  const milestone = Math.floor(reached / interval) * interval
  const checkDue = reached >= interval && milestone > 0 && !getSeen().has(milestone)

  if (!baselineActive && !checkDue) return null

  // Baseline takes visual precedence; dismissal is tracked per-reason so the
  // two alerts never cancel each other out.
  const showingBaseline = baselineActive
  const dismiss = () => {
    if (showingBaseline) setBaselineDismissed(reached)
    else addSeen(milestone)
    setOpen(false)
    force((n) => n + 1)
  }

  const saveReflection = async () => {
    if (reflection.trim()) {
      await addLearning('pivot', `[Pivot check @ ${reached} contacts] ${reflection.trim()}`)
      toast('Reflection saved to Learnings')
    }
    setReflection('')
    dismiss()
  }

  return (
    <div
      className={cx(
        'mb-6 overflow-hidden rounded-lg border animate-slide-up',
        showingBaseline ? 'border-danger/30 bg-danger/5' : 'border-streak/30 bg-streak/5'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={cx('mt-0.5 shrink-0', showingBaseline ? 'text-danger' : 'text-streak')}>
          {showingBaseline ? <AlertTriangle size={20} /> : <Compass size={20} />}
        </div>
        <div className="flex-1">
          <h3 className="font-display text-sm font-semibold text-primary">
            {showingBaseline
              ? `Baseline check: ${stats.responseRate}% response after ${reached} contacts`
              : `Pivot check — you've reached ${reached} people`}
          </h3>
          <p className="mt-0.5 text-sm text-secondary">
            {showingBaseline
              ? `You set a floor of ${settings.pivot_min_rate}% after ${settings.pivot_after_contacts} contacts. You're under it. Time to change the message, the target, or both — not send more of the same.`
              : 'Take two minutes to look at the data before sending the next batch.'}
          </p>
          {!open ? (
            <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
              Run the checklist <ChevronRight size={15} />
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <ul className="space-y-1.5">
                {PIVOT_CHECKLIST.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-secondary">
                    <span className="tnum mt-0.5 text-xs font-semibold text-muted">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
              <Textarea
                rows={3}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What did you observe — and what will you change?"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveReflection}>Save reflection &amp; dismiss</Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>Just dismiss</Button>
              </div>
            </div>
          )}
        </div>
        <button onClick={dismiss} className="shrink-0 text-muted transition-colors hover:text-primary" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
