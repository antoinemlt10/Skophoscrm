// ============================================================
// App shell: brand, responsive navigation (fixed sidebar on desktop,
// slide-in drawer on mobile), and a slim top bar. Pure presentation —
// the current view is owned by App.jsx.
// ============================================================
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarDays,
  MessageSquareText,
  BarChart3,
  Lightbulb,
  Settings,
  Flame,
  Menu,
  X,
  LogOut,
  Database,
  HardDrive,
} from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { cx } from '../ui.jsx'

export const NAV = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'targets', label: 'Targets', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'scheduler', label: 'Scheduler', icon: CalendarDays },
  { id: 'templates', label: 'Templates', icon: MessageSquareText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'learnings', label: 'Learnings', icon: Lightbulb },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
        {/* hexagon mark echoing the favicon */}
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M16 5 L25 10.5 L25 21.5 L16 27 L7 21.5 L7 10.5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="3.5" fill="currentColor" />
        </svg>
      </span>
      <div className="leading-none">
        <div className="font-display text-lg font-bold tracking-tight text-primary">Skophos</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">Prospecting CRM</div>
      </div>
    </div>
  )
}

function NavList({ view, setView, onPick }) {
  const { stats } = useData()
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = view === id
        const badge = id === 'pipeline' && stats.overdueCount > 0 ? stats.overdueCount : null
        return (
          <button
            key={id}
            onClick={() => {
              setView(id)
              onPick?.()
            }}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
              active ? 'bg-elevated text-primary' : 'text-secondary hover:bg-elevated/60 hover:text-primary'
            )}
          >
            <Icon size={18} strokeWidth={1.75} className={cx('shrink-0 transition-colors', active ? 'text-accent' : 'text-muted group-hover:text-secondary')} />
            <span className="flex-1 text-left">{label}</span>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            {badge && <span className="tnum rounded-full bg-danger/15 px-1.5 text-[11px] font-semibold text-danger">{badge}</span>}
          </button>
        )
      })}
    </nav>
  )
}

function SidebarBody({ view, setView, onPick, onSignOut }) {
  const { streak, mode } = useData()
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1 pt-1">
        <Wordmark />
      </div>

      <NavList view={view} setView={setView} onPick={onPick} />

      <div className="mt-auto flex flex-col gap-3">
        {/* Streak chip */}
        <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-elevated/50 px-3 py-2.5">
          <Flame size={20} className={cx('shrink-0', streak > 0 ? 'animate-flame text-streak' : 'text-muted')} fill={streak > 0 ? 'currentColor' : 'none'} />
          <div className="leading-tight">
            <div className="tnum text-sm font-semibold text-primary">{streak}-day streak</div>
            <div className="text-[11px] text-muted">{streak > 0 ? 'Keep it lit 🔥' : 'Hit your quota to start'}</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted" title={mode === 'supabase' ? 'Saving to Supabase' : 'Saving to this browser'}>
            {mode === 'supabase' ? <Database size={12} /> : <HardDrive size={12} />}
            {mode === 'supabase' ? 'Supabase' : 'Local'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('settings')}
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-primary"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={15} />
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-danger"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ view, setView, onSignOut, children }) {
  const [drawer, setDrawer] = useState(false)
  const title = NAV.find((n) => n.id === view)?.label || (view === 'settings' ? 'Settings' : '')

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border-subtle bg-surface/80 backdrop-blur lg:block">
        <SidebarBody view={view} setView={setView} onSignOut={onSignOut} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border-default bg-surface shadow-pop animate-slide-up">
            <SidebarBody view={view} setView={setView} onPick={() => setDrawer(false)} onSignOut={onSignOut} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border-subtle bg-base/80 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded-md text-secondary transition-colors hover:bg-elevated hover:text-primary lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="font-display text-base font-semibold text-primary">{title}</h1>
          <span className="ml-auto hidden text-sm text-muted sm:block">{todayLabel()}</span>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
