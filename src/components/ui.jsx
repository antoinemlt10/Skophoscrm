// ============================================================
// UI primitives — the small, reusable building blocks. Kept in one
// file so a non-expert can find every base component in one place.
// ============================================================
import { forwardRef } from 'react'

const cx = (...c) => c.filter(Boolean).join(' ')

/* ── Button ─────────────────────────────────────────────────── */
const BTN_VARIANTS = {
  primary:
    'bg-accent text-base font-semibold hover:bg-accent-hover shadow-glow disabled:bg-accent/40 disabled:shadow-none',
  secondary:
    'bg-elevated text-primary border border-border-default hover:border-border-strong hover:bg-overlay',
  ghost: 'text-secondary hover:text-primary hover:bg-elevated',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
  success: 'bg-success/10 text-success border border-success/30 hover:bg-success/20',
}
const BTN_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
  icon: 'h-9 w-9 rounded-md',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/* ── Card ────────────────────────────────────────────────────── */
export function Card({ className, children, ...props }) {
  return (
    <div className={cx('card p-5', className)} {...props}>
      {children}
    </div>
  )
}

/* ── Badge / Pill ────────────────────────────────────────────── */
export function Badge({ tone = 'muted', children, className, dot = false }) {
  const tones = {
    muted: 'bg-elevated text-secondary border-border-default',
    accent: 'bg-accent/12 text-accent border-accent/25',
    success: 'bg-success/12 text-success border-success/25',
    danger: 'bg-danger/12 text-danger border-danger/25',
    info: 'bg-info/12 text-info border-info/25',
    streak: 'bg-streak/12 text-streak border-streak/25',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone] || tones.muted,
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ── Form fields ─────────────────────────────────────────────── */
export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label-base">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx('input-base', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx('input-base resize-y leading-relaxed', className)} {...props} />
})

export function Select({ className, children, ...props }) {
  return (
    <select className={cx('input-base cursor-pointer appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
}

/* ── Progress ring (the hero quota gauge) ────────────────────── */
export function ProgressRing({ value, max, size = 132, stroke = 11, children }) {
  const safeMax = Math.max(max, 1)
  const pct = Math.min(value / safeMax, 1)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const complete = value >= safeMax
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-elevated" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          className={cx('transition-[stroke-dashoffset] duration-700 ease-out', complete ? 'stroke-success' : 'stroke-accent')}
          style={{ filter: complete ? 'drop-shadow(0 0 8px rgb(var(--success)/0.6))' : 'drop-shadow(0 0 6px rgb(var(--accent)/0.5))' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/* ── Linear progress bar ─────────────────────────────────────── */
export function ProgressBar({ value, max, tone = 'accent', className }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
  const tones = { accent: 'bg-accent', success: 'bg-success', info: 'bg-info', streak: 'bg-streak' }
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}>
      <div className={cx('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Stat tile ───────────────────────────────────────────────── */
export function Stat({ label, value, sub, tone = 'primary', icon: Icon }) {
  const toneClass = { primary: 'text-primary', accent: 'text-accent', success: 'text-success', danger: 'text-danger', info: 'text-info' }
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
        {Icon && <Icon size={14} strokeWidth={1.75} />}
        {label}
      </div>
      <div className={cx('tnum font-display text-3xl font-semibold leading-none', toneClass[tone])}>{value}</div>
      {sub && <div className="text-xs text-secondary">{sub}</div>}
    </div>
  )
}

/* ── Empty state ─────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-elevated text-muted">
          <Icon size={22} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-secondary">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ── Spinner ─────────────────────────────────────────────────── */
export function Spinner({ size = 18, className }) {
  return (
    <span
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}

/* ── Section heading ─────────────────────────────────────────── */
export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export { cx }
