// ============================================================
// TEMPLATES — edit your two message templates with merge variables,
// preview the merged result against a real contact, and keep a running
// "this isn't working" iteration log per version.
// ============================================================
import { useMemo, useRef, useState } from 'react'
import { Save, Eye, AlertCircle, Download, Plus, History } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { Button, Badge, Field, Input, Textarea, Select, SectionTitle, cx } from '../components/ui.jsx'
import { MERGE_VARS } from '../lib/constants.js'
import { mergeTemplate, missingVars } from '../lib/merge.js'
import { toCSV, downloadFile } from '../lib/csv.js'
import { shortDate } from '../lib/date.js'

export default function Templates() {
  const { templates } = useData()
  const [activeId, setActiveId] = useState(templates[0]?.id)
  const active = templates.find((t) => t.id === activeId) || templates[0]

  if (!active) return <p className="text-sm text-muted">No templates found.</p>

  return (
    <div className="space-y-5">
      <SectionTitle title="Templates" subtitle="Edit, preview, and iterate. Merge variables fill in automatically." />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* template switcher */}
        <div className="flex gap-2 lg:flex-col">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={cx(
                'flex-1 rounded-lg border p-3 text-left transition-all lg:flex-none',
                t.id === active.id ? 'border-accent/40 bg-accent/5' : 'border-border-subtle bg-surface hover:border-border-strong'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-primary">{t.name}</span>
                <Badge tone="muted">v{t.version}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{t.body.slice(0, 80)}…</p>
            </button>
          ))}
        </div>

        <Editor key={active.id} template={active} />
      </div>
    </div>
  )
}

/* ── Editor + preview + iteration log ─────────────────────────── */
function Editor({ template }) {
  const { templates, saveTemplate, template_notes, addTemplateNote, targets } = useData()
  const toast = useToast()
  const bodyRef = useRef(null)

  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject || '')
  const [body, setBody] = useState(template.body)
  const [previewId, setPreviewId] = useState(targets[0]?.id || '')
  const [showNotes, setShowNotes] = useState(false)
  const [observation, setObservation] = useState('')

  const dirty = name !== template.name || subject !== (template.subject || '') || body !== template.body
  const previewTarget = targets.find((t) => t.id === previewId)
  const merged = useMemo(
    () => mergeTemplate({ subject, body }, previewTarget || {}),
    [subject, body, previewTarget]
  )
  const missing = previewTarget ? missingVars({ subject, body }, previewTarget) : []
  const notes = template_notes
    .filter((n) => n.template_key === template.key)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Insert a merge variable at the cursor position in the body.
  const insertVar = (v) => {
    const el = bodyRef.current
    const start = el?.selectionStart ?? body.length
    const end = el?.selectionEnd ?? body.length
    const next = body.slice(0, start) + v + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + v.length
      el?.setSelectionRange(pos, pos)
    })
  }

  const save = async () => {
    await saveTemplate(template.id, { name, subject, body, bumpVersion: true })
    toast(`Saved “${name}” — now v${(template.version || 1) + 1}`)
  }

  const logNotWorking = async () => {
    if (!observation.trim()) return toast('Jot down what you observed first', 'error')
    await addTemplateNote(template.key, template.version, observation.trim())
    toast('Observation logged')
    setObservation('')
    setShowNotes(true)
  }

  const exportNotes = () => {
    if (!template_notes.length) return toast('No iteration notes yet', 'error')
    const cols = [
      { label: 'Template', get: (n) => n.template_key },
      { label: 'Version', get: (n) => n.template_version },
      { label: 'Observation', get: (n) => n.observation },
      { label: 'Date', get: (n) => n.created_at },
    ]
    downloadFile('skophos-message-iterations.csv', toCSV(template_notes, cols))
    toast('Exported iteration notes')
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Field label="Template name" className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="pt-6"><Badge tone="muted">v{template.version}</Badge></div>
        </div>

        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="label-base mb-0">Body</span>
            <div className="flex flex-wrap gap-1">
              {MERGE_VARS.map((v) => (
                <button key={v} onClick={() => insertVar(v)} className="rounded border border-border-default bg-base px-2 py-0.5 font-mono text-xs text-accent transition-colors hover:border-accent/40 hover:bg-accent/5" title={`Insert ${v}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-sans leading-relaxed" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNotes((s) => !s)}>
            <AlertCircle size={15} /> This message isn't working
          </Button>
          <Button onClick={save} disabled={!dirty}>
            <Save size={16} /> {dirty ? 'Save new version' : 'Saved'}
          </Button>
        </div>
      </div>

      {/* iteration log */}
      {showNotes && (
        <div className="card space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-primary"><History size={15} /> Iteration log</h3>
            <Button variant="ghost" size="sm" onClick={exportNotes}><Download size={14} /> Export</Button>
          </div>
          <div className="flex gap-2">
            <Textarea rows={2} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="e.g. 0/12 replies on v1 — subject line too vague, no specific paper mentioned." className="flex-1" />
            <Button onClick={logNotWorking} className="self-stretch"><Plus size={16} /></Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-muted">No observations logged for this template yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border border-border-subtle bg-base p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                    <Badge tone="muted">v{n.template_version}</Badge>
                    <span>{shortDate(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-secondary">{n.observation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* live preview */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-primary"><Eye size={15} /> Live preview</h3>
          <Select value={previewId} onChange={(e) => setPreviewId(e.target.value)} className="h-9 w-56 py-0 text-sm">
            <option value="">Pick a contact…</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        {missing.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-streak"><AlertCircle size={13} /> {previewTarget?.name} is missing: {missing.join(', ')} (a sensible fallback is used)</p>
        )}
        <div className="rounded-md border border-border-subtle bg-base p-4">
          {merged.subject && <p className="mb-3 border-b border-border-subtle pb-2 text-sm font-semibold text-secondary">Subject: {merged.subject}</p>}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-primary">{merged.body}</pre>
        </div>
      </div>
    </div>
  )
}
