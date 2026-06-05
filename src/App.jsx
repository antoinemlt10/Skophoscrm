// ============================================================
// App root — providers, auth gate, and the lightweight view router.
// No react-router: a single `view` string keeps the whole app in one
// place and makes deployment (and reading the code) dead simple.
// ============================================================
import { useState } from 'react'
import { ToastProvider } from './context/ToastContext.jsx'
import { DataProvider, useData } from './context/DataContext.jsx'
import { CelebrationProvider } from './components/Celebration.jsx'
import AuthGate from './components/AuthGate.jsx'
import AppShell from './components/layout/AppShell.jsx'
import { Spinner, Button } from './components/ui.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Targets from './pages/Targets.jsx'
import Pipeline from './pages/Pipeline.jsx'
import Scheduler from './pages/Scheduler.jsx'
import Templates from './pages/Templates.jsx'
import Analytics from './pages/Analytics.jsx'
import Learnings from './pages/Learnings.jsx'
import Settings from './pages/Settings.jsx'

const VIEWS = {
  today: Dashboard,
  targets: Targets,
  pipeline: Pipeline,
  scheduler: Scheduler,
  templates: Templates,
  analytics: Analytics,
  learnings: Learnings,
  settings: Settings,
}

function MainApp({ signOut }) {
  const [view, setView] = useState('today')
  const { loading, error } = useData()

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />

  const ViewComponent = VIEWS[view] || Dashboard
  return (
    <AppShell view={view} setView={setView} onSignOut={signOut}>
      <ViewComponent />
    </AppShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>
        {({ signOut }) => (
          <DataProvider>
            <CelebrationProvider>
              <MainApp signOut={signOut} />
            </CelebrationProvider>
          </DataProvider>
        )}
      </AuthGate>
    </ToastProvider>
  )
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={26} className="text-accent" />
        <p className="text-sm text-muted">Loading your cockpit…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md text-center">
        <h2 className="font-display text-lg font-semibold text-danger">Something went wrong</h2>
        <p className="mt-2 text-sm text-secondary">{error}</p>
        <p className="mt-2 text-xs text-muted">If you just set up Supabase, double-check your URL and anon key, then that the migration ran.</p>
        <Button className="mt-5" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </div>
  )
}
