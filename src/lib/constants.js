// ============================================================
// Shared vocabulary for the whole app. Change things here once.
// ============================================================

// Pipeline stages, in order. The Kanban board renders them left→right.
export const STAGES = [
  'Prospect',
  'Contacted',
  'Responded',
  'Demo Scheduled',
  'Onboarded',
  'Lost',
]

// Per-stage accent so the pipeline reads at a glance (Tailwind color keys).
export const STAGE_META = {
  Prospect: { color: 'muted', hint: 'Not yet contacted' },
  Contacted: { color: 'info', hint: 'Waiting on a reply' },
  Responded: { color: 'accent', hint: 'They replied — keep it warm' },
  'Demo Scheduled': { color: 'streak', hint: 'A call is booked' },
  Onboarded: { color: 'success', hint: 'A beta tester 🎉' },
  Lost: { color: 'danger', hint: 'Closed out' },
}

export const CHANNELS = ['Email', 'LinkedIn']
export const PRIORITIES = ['High', 'Medium', 'Low']
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const RESPONSE_TYPES = ['Interested', 'Not now', 'Not relevant', 'Referral', 'Ghosted']
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative']

// "Interested" is the magic moment we celebrate.
export const WIN_RESPONSE = 'Interested'

// Merge variables supported by templates.
export const MERGE_VARS = ['[Name]', '[Department]', '[Lab]', '[Hook]']

// The two templates that ship pre-filled. `key` is stable; `body` is editable in-app.
export const DEFAULT_TEMPLATES = [
  {
    key: 'first_contact',
    name: 'First Contact',
    subject: 'A weekly paper digest tuned to [Lab]',
    body: `Hi [Name],

I came across your work in [Department] — [Hook]. It's exactly the kind of fast-moving area where keeping up with new papers is a part-time job in itself.

I'm building Skophos: a tool that reads PubMed, bioRxiv and medRxiv every week and sends you a short, personalized digest of only the papers that match your research profile. No feeds to scroll, no alerts to tune — just the 5–8 things worth your time, in your inbox every Monday.

I'm onboarding a handful of Berkeley researchers as early testers (free, obviously). Could I set you up with a profile this week and send you next Monday's digest? I'd love your honest read on whether it's actually useful.

Best,
Antoine
UC Berkeley · Skophos`,
  },
  {
    key: 'followup_bump',
    name: 'Follow-up Bump',
    subject: 'Re: A weekly paper digest tuned to [Lab]',
    body: `Hi [Name],

Quick bump on this — I know inboxes in [Department] are brutal.

If a weekly, profile-matched digest of the new papers worth your time would save you even 20 minutes a week, I'd love to set you up as a free beta tester. One reply and I'll handle the rest.

If it's not relevant right now, no worries at all — just let me know and I'll stop bugging you.

Best,
Antoine`,
  },
]

// The pivot-check questions surfaced every N contacts.
export const PIVOT_CHECKLIST = [
  'What is the response rate right now — and is it trending up or flat?',
  'Of the replies, what is the quality (Interested vs polite no)?',
  'Is one department / channel clearly out-converting the others?',
  'What is the dominant sentiment of replies — and what does it tell you?',
  'Does anything you observed change your core hypothesis?',
]
