// ============================================================
// Celebration system — one place that owns confetti + the milestone modals.
// Any page can call useCelebration().celebrateWin(target),
// .celebrateOnboard(target), or .celebrateQuota().
// ============================================================
import { createContext, useCallback, useContext, useState } from 'react'
import { PartyPopper, Sparkles, Rocket } from 'lucide-react'
import Confetti from './Confetti.jsx'
import Modal from './Modal.jsx'
import { Button } from './ui.jsx'
import { useData } from '../context/DataContext.jsx'

const CelebrationContext = createContext(null)
export const useCelebration = () => useContext(CelebrationContext)

export function CelebrationProvider({ children }) {
  const { markFirstWinCelebrated } = useData()
  const [confetti, setConfetti] = useState(false)
  const [intensity, setIntensity] = useState(1)
  const [winTarget, setWinTarget] = useState(null)
  const [onboardTarget, setOnboardTarget] = useState(null)

  const fire = (level) => {
    setIntensity(level)
    setConfetti(true)
  }

  // First "Interested" reply ever — the big psychological moment (extra confetti).
  const celebrateWin = useCallback(
    (target) => {
      setWinTarget(target)
      fire(2)
      markFirstWinCelebrated()
    },
    [markFirstWinCelebrated]
  )

  // A target reaches "Onboarded" — the real Phase 0 win. The strongest burst.
  const celebrateOnboard = useCallback((target) => {
    setOnboardTarget(target)
    fire(2.2)
  }, [])

  // Hit the daily quota — a quieter burst, no modal.
  const celebrateQuota = useCallback(() => fire(1), [])

  return (
    <CelebrationContext.Provider value={{ celebrateWin, celebrateOnboard, celebrateQuota }}>
      {children}
      <Confetti active={confetti} intensity={intensity} onDone={() => setConfetti(false)} />

      {/* First "Interested" reply */}
      <Modal open={Boolean(winTarget)} onClose={() => setWinTarget(null)} size="sm" closeOnBackdrop={false}>
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <span className="mb-4 grid h-16 w-16 origin-bottom animate-bounce-soft place-items-center rounded-2xl bg-success/15 text-success ring-1 ring-success/30">
            <PartyPopper size={30} />
          </span>
          <h2 className="font-display text-2xl font-bold text-primary">Your first YES. 🎉</h2>
          <p className="mt-2 text-sm text-secondary">
            <span className="font-semibold text-primary">{winTarget?.name}</span> is interested. This is the signal you've been
            sending all those emails for — proof the message can land.
          </p>
          {winTarget?.response_quote && (
            <blockquote className="mt-4 w-full rounded-lg border border-border-subtle bg-elevated/60 px-4 py-3 text-left text-sm italic text-primary">
              “{winTarget.response_quote}”
            </blockquote>
          )}
          <div className="mt-5 flex items-center gap-1.5 text-xs text-muted">
            <Sparkles size={14} className="text-streak" />
            Log it, screenshot it, and go get the next one.
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={() => setWinTarget(null)}>
            Keep the momentum
          </Button>
        </div>
      </Modal>

      {/* Onboarded — a beta tester secured */}
      <Modal open={Boolean(onboardTarget)} onClose={() => setOnboardTarget(null)} size="sm" closeOnBackdrop={false}>
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <span className="mb-4 grid h-16 w-16 origin-bottom animate-bounce-soft place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <Rocket size={30} />
          </span>
          <h2 className="font-display text-2xl font-bold text-primary">Beta tester onboarded! 🚀</h2>
          <p className="mt-2 text-sm text-secondary">
            <span className="font-semibold text-primary">{onboardTarget?.name}</span> is in. That's not a metric — that's a
            real researcher trusting Skophos with their week. This is exactly what Phase 0 validation looks like.
          </p>
          <div className="mt-5 flex items-center gap-1.5 text-xs text-muted">
            <Sparkles size={14} className="text-streak" />
            One down. A handful of these and you've proven the wedge.
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={() => setOnboardTarget(null)}>
            Onto the next
          </Button>
        </div>
      </Modal>
    </CelebrationContext.Provider>
  )
}
