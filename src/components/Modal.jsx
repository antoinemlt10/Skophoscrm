// ============================================================
// Accessible modal: ESC to close, click-outside to close, focus trap-ish,
// scroll-locked body. Renders nothing when closed.
// ============================================================
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cx } from './ui.jsx'

export default function Modal({ open, onClose, title, children, footer, size = 'md', closeOnBackdrop = true }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    const panel = panelRef.current
    const focusable = () =>
      panel
        ? [...panel.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(
            (el) => el.offsetParent !== null
          )
        : []

    const onKey = (e) => {
      if (e.key === 'Escape') return onClose?.()
      if (e.key !== 'Tab') return
      // Trap Tab inside the dialog so focus can't reach the page behind it.
      const f = focusable()
      if (f.length === 0) return e.preventDefault()
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog — but respect an autoFocus'd field if present.
    if (panel && !panel.contains(document.activeElement)) (focusable()[0] || panel).focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      // Restore focus to whatever opened the modal.
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      {/* panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border-default bg-surface shadow-pop outline-none animate-scale-in sm:rounded-2xl',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-primary"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
