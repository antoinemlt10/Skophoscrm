// ============================================================
// Lightweight toast system. useToast() → toast('Saved', 'success').
// ============================================================
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info }
const TONE = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (message, type = 'success', ttl = 3200) => {
      const id = ++idRef.current
      setToasts((t) => [...t, { id, message, type }])
      if (ttl) setTimeout(() => dismiss(id), ttl)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border-default bg-elevated/95 px-4 py-3 shadow-pop backdrop-blur animate-scale-in"
            >
              <Icon size={18} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${TONE[t.type] || ''}`} />
              <p className="flex-1 text-sm text-primary">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-muted transition-colors hover:text-primary"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
