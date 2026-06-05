// ============================================================
// ANALYTICS — the numbers that tell you whether to keep going or pivot.
// Headline stats, a pipeline funnel, and cohort breakdowns by
// department / channel / template version (what actually converts).
// ============================================================
import { Users, Send, MessageCircle, Clock, Trophy } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { Stat, SectionTitle, cx } from '../components/ui.jsx'

export default function Analytics() {
  const { stats, funnel, cohorts } = useData()

  return (
    <div className="space-y-7">
      <SectionTitle title="Analytics" subtitle="What's working — and what to change." />

      {/* headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Targets" value={stats.total} icon={Users} />
        <Stat label="Reached" value={stats.reachedCount} icon={Send} sub={`${stats.total ? Math.round((stats.reachedCount / stats.total) * 100) : 0}% of pipeline`} />
        <Stat label="Response rate" value={`${stats.responseRate}%`} tone="accent" icon={MessageCircle} sub={`${stats.respondedCount} repl${stats.respondedCount === 1 ? 'y' : 'ies'}`} />
        <Stat label="Awaiting" value={stats.awaitingCount} icon={Clock} tone={stats.overdueCount ? 'danger' : 'primary'} sub={stats.overdueCount ? `${stats.overdueCount} overdue` : 'on track'} />
        <Stat label="Onboarded" value={stats.onboardedCount} tone="success" icon={Trophy} />
      </div>

      {/* funnel */}
      <div className="card">
        <h3 className="mb-4 font-display text-sm font-semibold text-primary">Pipeline funnel</h3>
        <Funnel funnel={funnel} />
      </div>

      {/* cohorts */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Cohort title="By department" rows={cohorts.department} />
        <Cohort title="By channel" rows={cohorts.channel} />
        <Cohort title="By template version" rows={cohorts.template} />
      </div>

      <p className="text-xs text-muted">
        Response rate = replies ÷ people reached. Cohorts only count targets you've actually contacted, so small samples will look noisy early — read them once you're past ~20 contacts per bucket.
      </p>
    </div>
  )
}

/* ── Funnel: stacked horizontal bars ──────────────────────────── */
function Funnel({ funnel }) {
  const top = Math.max(funnel[0]?.count || 0, 1)
  return (
    <div className="space-y-2.5">
      {funnel.map((step, i) => {
        const widthPct = Math.max((step.count / top) * 100, step.count > 0 ? 6 : 2)
        const convPct = top ? Math.round((step.count / top) * 100) : 0
        return (
          <div key={step.stage} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-sm text-secondary">{step.stage}</span>
            <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-elevated">
              <div
                className={cx('flex h-full items-center rounded-md px-2.5 transition-[width] duration-700 ease-out', i === 0 ? 'bg-accent/30' : 'bg-accent/20')}
                style={{ width: `${widthPct}%`, background: `rgb(var(--accent) / ${0.32 - i * 0.045})` }}
              >
                <span className="tnum text-xs font-semibold text-primary">{step.count}</span>
              </div>
            </div>
            <span className="tnum w-12 shrink-0 text-right text-xs text-muted">{convPct}%</span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Cohort table with rate bars ──────────────────────────────── */
function Cohort({ title, rows }) {
  const best = rows.reduce((m, r) => Math.max(m, r.rate), 0)
  return (
    <div className="card">
      <h3 className="mb-3 font-display text-sm font-semibold text-primary">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No data yet</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-primary">{r.key}</span>
                <span className="tnum flex items-center gap-1.5 text-muted">
                  <span className={cx('font-semibold', r.rate > 0 && r.rate === best ? 'text-success' : 'text-secondary')}>{r.rate}%</span>
                  <span className="text-xs">({r.responded}/{r.reached})</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className={cx('h-full rounded-full', r.rate > 0 && r.rate === best ? 'bg-success' : 'bg-accent')} style={{ width: `${Math.min(r.rate, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
