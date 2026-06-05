-- ============================================================================
-- Skophos CRM — initial schema
-- Run this in Supabase → SQL Editor (paste the whole file, click "Run").
-- Safe to re-run: every object uses "if not exists" / "create or replace".
--
-- ⚠️  SECURITY — THE SINGLE MOST IMPORTANT STEP IS NOT IN THIS FILE:
--     After running it, go to Authentication → Providers → Email and turn OFF
--     "Enable sign-ups". RLS isolates each account's data, but it does NOT stop
--     a stranger with your public URL from self-registering their own account.
--     Disabling sign-ups is what keeps this truly single-user.
--     (Optional defense-in-depth trigger is at the bottom of this file.)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── helper: keep updated_at fresh ───────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================================
-- TARGETS  — the people you're reaching out to (the heart of the CRM)
-- ============================================================================
create table if not exists public.targets (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  email           text,
  department      text,
  lab             text,
  research_area   text,
  hook            text,                              -- personalization hook merged into [Hook]
  status          text not null default 'Prospect',  -- Prospect|Contacted|Responded|Demo Scheduled|Onboarded|Lost
  priority        text not null default 'Medium',     -- High|Medium|Low
  scheduled_day   text,                               -- Mon|Tue|Wed|Thu|Fri|Sat|Sun (batch scheduler)
  channel         text not null default 'Email',      -- Email|LinkedIn
  last_contact_date  timestamptz,
  next_followup_date date,
  followup_days   int not null default 5,             -- N days; next_followup = contact + N
  notes           text,
  last_message_text text,                             -- full text of the last message actually sent
  last_template_key text,                             -- which template was used
  last_template_version int,                          -- which version of it
  -- response capture
  response_type      text,   -- Interested|Not now|Not relevant|Referral|Ghosted
  response_sentiment text,   -- Positive|Neutral|Negative
  response_quote     text,
  responded_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_targets_updated on public.targets;
create trigger trg_targets_updated before update on public.targets
  for each row execute function public.set_updated_at();

create index if not exists idx_targets_owner   on public.targets(owner);
create index if not exists idx_targets_status  on public.targets(status);
create index if not exists idx_targets_day     on public.targets(scheduled_day);
create index if not exists idx_targets_followup on public.targets(next_followup_date);

-- ============================================================================
-- TEMPLATES — editable message templates with merge variables
-- ============================================================================
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key         text not null,                 -- 'first_contact' | 'followup_bump' (stable id)
  name        text not null,
  subject     text,
  body        text not null,
  version     int  not null default 1,       -- bumped each time you save an edit
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, key)
);

drop trigger if exists trg_templates_updated on public.templates;
create trigger trg_templates_updated before update on public.templates
  for each row execute function public.set_updated_at();

-- ============================================================================
-- TEMPLATE_NOTES — the "this message isn't working" iteration log
-- ============================================================================
create table if not exists public.template_notes (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_key     text not null,
  template_version int,
  observation      text not null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_tnotes_owner on public.template_notes(owner);

-- ============================================================================
-- TRANSITIONS — pipeline status history (timestamp per state change)
-- ============================================================================
create table if not exists public.transitions (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_id   uuid not null references public.targets(id) on delete cascade,
  from_status text,
  to_status   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_transitions_target on public.transitions(target_id);
create index if not exists idx_transitions_owner  on public.transitions(owner);

-- ============================================================================
-- ACTIVITY — one row per outreach action "marked as sent".
-- Powers the daily quota progress + streak (derived, never hand-counted).
-- ============================================================================
create table if not exists public.activity (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_id        uuid references public.targets(id) on delete set null,
  action_type      text not null,            -- 'first_contact' | 'followup'
  template_key     text,
  template_version int,
  message_text     text,
  -- The app always supplies activity_date as the user's LOCAL day (for streak
  -- math). This default only matters for rows inserted without it; we match the
  -- app's timezone so a fallback insert lands on the same day. Adjust if you move.
  activity_date    date not null default (now() at time zone 'America/Los_Angeles')::date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_activity_owner_date on public.activity(owner, activity_date);

-- ============================================================================
-- LEARNINGS — convictions & observations log
-- ============================================================================
create table if not exists public.learnings (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null default 'observation',  -- observation|conviction|pivot
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_learnings_owner on public.learnings(owner);

-- ============================================================================
-- SETTINGS — one row per user (quota, follow-up window, pivot thresholds,
-- and first-win celebration flag). Streak/progress are derived from activity.
-- ============================================================================
create table if not exists public.settings (
  owner                  uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_quota            int  not null default 5,
  followup_days          int  not null default 5,
  pivot_after_contacts   int  not null default 50,
  pivot_min_rate         numeric not null default 5,   -- percent
  pivot_check_interval   int  not null default 20,
  first_win_celebrated   boolean not null default false,
  updated_at             timestamptz not null default now()
);

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- Single-user-private: every row is scoped to its owner = auth.uid().
-- Even though it's "just you", this guarantees nobody else with the public
-- anon key can read or write your data.
-- ============================================================================
alter table public.targets        enable row level security;
alter table public.templates      enable row level security;
alter table public.template_notes enable row level security;
alter table public.transitions    enable row level security;
alter table public.activity       enable row level security;
alter table public.learnings      enable row level security;
alter table public.settings       enable row level security;

-- One policy per table: you can do anything to rows you own.
do $$
declare t text;
begin
  foreach t in array array['targets','templates','template_notes','transitions','activity','learnings']
  loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
      t
    );
  end loop;
end $$;

drop policy if exists own_settings on public.settings;
create policy own_settings on public.settings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ============================================================================
-- OPTIONAL defense-in-depth: hard-lock the database to a single email so that
-- even if sign-ups are accidentally left on, no other account can be created.
-- Uncomment, replace the email, and run it. (Disabling sign-ups in the Auth
-- settings is still the primary control — this is a belt-and-suspenders backup.)
-- ----------------------------------------------------------------------------
-- create or replace function public.only_owner_signup()
-- returns trigger language plpgsql security definer as $$
-- begin
--   if lower(new.email) <> lower('you@berkeley.edu') then
--     raise exception 'Sign-ups are disabled for this app.';
--   end if;
--   return new;
-- end; $$;
-- drop trigger if exists trg_only_owner on auth.users;
-- create trigger trg_only_owner before insert on auth.users
--   for each row execute function public.only_owner_signup();
-- ============================================================================

-- ============================================================================
-- Done. Next:
--   1. Authentication → Users → Add user (email + password, Auto Confirm on).
--   2. Authentication → Providers → Email → turn OFF "Enable sign-ups".  ← required
-- ============================================================================
