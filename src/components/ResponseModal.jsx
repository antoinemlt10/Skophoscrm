// ============================================================
// Capture a reply: type, sentiment, optional quote. Returns the result
// to the parent so it can fire the first-win celebration.
// ============================================================
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Button, Field, Textarea } from './ui.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { RESPONSE_TYPES, SENTIMENTS } from '../lib/constants.js'
import { cx } from './ui.jsx'

const TYPE_TONE = {
  Interested: 'success',
  Referral: 'info',
  'Not now': 'streak',
  'Not relevant': 'muted',
  Ghosted: 'danger',
}
const SENT_TONE = { Positive: 'success', Neutral: 'info', Negative: 'danger' }

export default function ResponseModal({ open, onClose, target, onWin }) {
  const { logResponse } = useData()
  const toast = useToast()
  const [type, setType] = useState('Interested')
  const [sentiment, setSentiment] = useState('Positive')
  const [quote, setQuote] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset to defaults every time the modal opens for a (new) target, so a
  // cancelled or failed entry never leaks into the next contact's reply.
  useEffect(() => {
    if (open) {
      setType('Interested')
      setSentiment('Positive')
      setQuote('')
    }
  }, [open, target?.id])

  if (!target) return null

  const submit = async () => {
    setBusy(true)
    try {
      const { firstWin } = await logResponse(target, { type, sentiment, quote })
      toast(`Logged ${target.name.split(' ')[0]}'s reply`)
      onClose()
      if (firstWin) onWin?.(target)
      // reset for next time
      setType('Interested')
      setSentiment('Positive')
      setQuote('')
    } catch (e) {
      toast(e.message || 'Could not save', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reply from ${target.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Save reply</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Response type">
          <Choices options={RESPONSE_TYPES} value={type} onChange={setType} toneMap={TYPE_TONE} />
        </Field>
        <Field label="Sentiment">
          <Choices options={SENTIMENTS} value={sentiment} onChange={setSentiment} toneMap={SENT_TONE} />
        </Field>
        <Field label="Quote from their reply" hint="Optional — a phrase you want to remember for messaging.">
          <Textarea rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="“Interesting idea — swamped until the summer though.”" />
        </Field>
      </div>
    </Modal>
  )
}

function Choices({ options, value, onChange, toneMap }) {
  const tones = {
    success: 'border-success/40 bg-success/12 text-success',
    info: 'border-info/40 bg-info/12 text-info',
    streak: 'border-streak/40 bg-streak/12 text-streak',
    danger: 'border-danger/40 bg-danger/12 text-danger',
    muted: 'border-border-strong bg-elevated text-primary',
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt
        const tone = tones[toneMap[opt]] || tones.muted
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cx(
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-all active:scale-95',
              active ? tone : 'border-border-default text-secondary hover:border-border-strong hover:text-primary'
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
