// ============================================================
// AuthGate — protects the app.
//
//  • Supabase configured → real email/password auth (sessions, RLS).
//    This is the secure option: your data is protected server-side.
//  • Not configured      → optional password gate (VITE_APP_PASSWORD).
//    NOTE: a client-side gate only hides the UI; with localStorage your
//    data never leaves the browser anyway. For a public deploy, use Supabase.
//
// Renders children as a function: children({ signOut }).
// ============================================================
import { useEffect, useState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { Button, Input, Spinner } from './ui.jsx'

const GATE_KEY = 'skophos.gate'
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD?.trim()

export default function AuthGate({ children }) {
  // ── Supabase mode ────────────────────────────────────────────
  if (isSupabaseConfigured) return <SupabaseGate>{children}</SupabaseGate>

  // ── localStorage mode: optional password gate ────────────────
  return <PasswordGate>{children}</PasswordGate>
}

/* ---------- Supabase email/password ---------- */
function SupabaseGate({ children }) {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (checking) return <FullScreenLoader />
  if (!session) return <LoginScreen mode="supabase" />

  return children({ signOut: () => supabase.auth.signOut() })
}

/* ---------- Password gate (localStorage) ---------- */
function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(() => !APP_PASSWORD || sessionStorage.getItem(GATE_KEY) === '1')
  if (!authed) return <LoginScreen mode="password" onSuccess={() => setAuthed(true)} />
  return children({
    signOut: APP_PASSWORD
      ? () => {
          sessionStorage.removeItem(GATE_KEY)
          setAuthed(false)
        }
      : null,
  })
}

/* ---------- Shared login screen ---------- */
function LoginScreen({ mode, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (mode === 'supabase') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        if (password === APP_PASSWORD) {
          sessionStorage.setItem(GATE_KEY, '1')
          onSuccess()
        } else {
          throw new Error('Incorrect password')
        }
      }
    } catch (e2) {
      setErr(e2.message || 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      {/* ambient ember glow behind the card */}
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgb(var(--accent)/0.10), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm animate-scale-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 5 L25 10.5 L25 21.5 L16 27 L7 21.5 L7 10.5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="16" cy="16" r="3.5" fill="currentColor" />
            </svg>
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary">Skophos CRM</h1>
          <p className="mt-1 text-sm text-secondary">Your daily outreach cockpit. Sign in to keep the streak alive.</p>
        </div>

        <form onSubmit={submit} className="card space-y-3 p-6">
          {mode === 'supabase' && (
            <Input type="email" autoComplete="email" placeholder="you@berkeley.edu" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          )}
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              className="pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus={mode === 'password'}
            />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : <>Enter <ArrowRight size={18} /></>}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {mode === 'supabase' ? 'Private workspace — accounts are created in Supabase.' : 'Private workspace — local to this browser.'}
        </p>
      </div>
    </div>
  )
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner size={28} className="text-accent" />
    </div>
  )
}
