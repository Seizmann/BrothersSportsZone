-- 0001_initial_schema.sql — BrothersSportsZone initial schema
-- Source of truth for entity list: REQUIREMENT.md §7 (updated in the same session
-- to include booking_payments — see DECISION.md D-001 for why financial columns
-- live in a separate table).

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- users — public mirror of auth.users (Supabase Auth owns credentials)
-- ============================================================================

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  -- customer and team_owner are the same account; role tracks presentation only
  role text not null default 'customer' check (role in ('customer', 'team_owner')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy users_select_own on public.users
  for select using (auth.uid() = id);

-- Auto-create the public.users row on signup so every account is immediately
-- a customer / team owner (REQUIREMENT.md §4.1 — no approval flow).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- turf — single venue for MVP; a unique index on a constant enforces one row
-- ============================================================================

create table public.turf (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photos_r2_keys jsonb not null default '[]',
  opening_hours_json jsonb not null default '{}',
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

alter table public.turf enable row level security;
create unique index turf_single_row on public.turf ((true));

-- ============================================================================
-- site_settings — single row; pricing/slots are DB-driven, no env pricing
-- ============================================================================

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  slot_duration_minutes int not null check (slot_duration_minutes > 0),
  slot_per_day_json jsonb not null default '{}',
  pricing_rules_json jsonb not null default '{}',
  owner_details_json jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
create unique index site_settings_single_row on public.site_settings ((true));

-- ============================================================================
-- staff — three fixed tiers (sudo_admin / manager / stuff), see REQUIREMENT.md §4.3
-- ============================================================================

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  turf_id uuid not null references public.turf (id),
  role text not null check (role in ('sudo_admin', 'manager', 'stuff')),
  active_status boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Helper used by every staff-gated policy. security definer avoids recursive
-- RLS evaluation on the staff table itself. Returns NULL for non-staff.
create or replace function public.current_staff_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.staff where user_id = auth.uid() and active_status;
$$;

revoke execute on function public.current_staff_role() from anon;
grant execute on function public.current_staff_role() to authenticated;

create policy staff_select on public.staff
  for select using (auth.uid() = user_id or public.current_staff_role() is not null);

create policy staff_manage on public.staff
  for all
  using (public.current_staff_role() in ('sudo_admin', 'manager'))
  with check (public.current_staff_role() in ('sudo_admin', 'manager'));

-- ============================================================================
-- bookings — operational data only. Financial columns (paid/due/discount) live
-- in booking_payments so RLS can truly hide them from the stuff role (DECISION.md D-001).
-- ============================================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id), -- null for walk-ins booked by staff
  turf_id uuid not null references public.turf (id),
  slot_date date not null,
  slot_time time not null,
  customer_name text not null,
  customer_phone text not null,
  team_name text,
  booking_cost numeric(12, 2) not null check (booking_cost >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'checked-in', 'completed', 'cancelled', 'no_show')),
  cancellation_reason text,
  staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Calendar lookups: given a turf + date, find that day's bookings fast.
create index bookings_turf_date_idx on public.bookings (turf_id, slot_date);

-- booking_payments — money columns with their own hard RLS wall (see D-001).
create table public.booking_payments (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  due_amount numeric(12, 2) not null default 0 check (due_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  payment_method_note text,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- activity_log — audit trail; append-only (no update/delete policies)
-- ============================================================================

create table public.activity_log (
  id bigint generated always as identity primary key,
  staff_id uuid references public.staff (id),
  action_type text not null,
  resource_type text not null,
  resource_id text,
  details_json jsonb not null default '{}', -- before/after values per REQUIREMENT.md §4.6
  created_at timestamptz not null default now()
);

-- ============================================================================
-- teams / team_players — every signup is a team owner (§5.5)
-- ============================================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  logo_r2_key text,
  description text,
  created_at timestamptz not null default now()
);

create index teams_owner_idx on public.teams (owner_user_id);

create table public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_name text not null,
  player_photo_r2_key text,
  -- drag-and-drop field layout coordinates (§5.5); null until positioned
  position_x numeric,
  position_y numeric
);

create index team_players_team_idx on public.team_players (team_id);

-- ============================================================================
-- matches / match_events — ad-hoc or registered team per side (§5.2)
-- ============================================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team1_id uuid references public.teams (id),
  team2_id uuid references public.teams (id),
  team1_name_adhoc text,
  team2_name_adhoc text,
  match_format text not null check (match_format in ('5-a-side', '7-a-side', '11-a-side')),
  status text not null default 'not_started'
    check (status in ('not_started', 'first_half', 'half_time', 'second_half', 'full_time')),
  admin_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  -- exactly one of (registered team id, ad-hoc name) per side — resolves the
  -- open question in REQUIREMENT.md §7 ("Likely yes" now enforced)
  constraint match_side1_valid check ((team1_id is not null) <> (team1_name_adhoc is not null)),
  constraint match_side2_valid check ((team2_id is not null) <> (team2_name_adhoc is not null))
);

create index matches_status_created_idx on public.matches (status, created_at desc);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  event_type text not null check (event_type in ('goal', 'card')),
  minute int not null check (minute between 0 and 130),
  player_name text not null,
  team_id uuid references public.teams (id),
  details_json jsonb not null default '{}', -- e.g. {"card": "yellow"}
  created_at timestamptz not null default now()
);

create index match_events_match_idx on public.match_events (match_id, minute);

-- ============================================================================
-- expenses — sudo_admin + manager only, enforced by RLS below (§4.3)
-- ============================================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null,
  expense_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security — policies for every table (AGENT.md §5)
-- Role matrix per REQUIREMENT.md §4.3:
--   sudo_admin: everything
--   manager:    everything except site_settings writes
--   stuff:      operational only — no financial reads, no staff mgmt, no discounts
-- ============================================================================

-- turf: public read; staff managers write
alter table public.turf enable row level security;
create policy turf_public_read on public.turf for select using (true);
create policy turf_write on public.turf for all
  using (public.current_staff_role() in ('sudo_admin', 'manager'))
  with check (public.current_staff_role() in ('sudo_admin', 'manager'));

-- site_settings: public read (booking form needs pricing); sudo_admin writes only
alter table public.site_settings enable row level security;
create policy site_settings_public_read on public.site_settings for select using (true);
create policy site_settings_admin_write on public.site_settings for all
  using (public.current_staff_role() = 'sudo_admin')
  with check (public.current_staff_role() = 'sudo_admin');

-- bookings: customers see their own; all staff see operational columns;
-- update is staff-only; no deletes (terminal statuses exist for that)
alter table public.bookings enable row level security;
create policy bookings_select on public.bookings for select
  using (auth.uid() = user_id or public.current_staff_role() is not null);
create policy bookings_insert on public.bookings for insert
  with check (auth.uid() = user_id or public.current_staff_role() is not null);
create policy bookings_update on public.bookings for update
  using (public.current_staff_role() is not null)
  with check (public.current_staff_role() is not null);

-- booking_payments: the hard wall — sudo_admin/manager only (D-001)
alter table public.booking_payments enable row level security;
create policy booking_payments_financial on public.booking_payments for all
  using (public.current_staff_role() in ('sudo_admin', 'manager'))
  with check (public.current_staff_role() in ('sudo_admin', 'manager'));

-- activity_log: staff read, staff append; nothing can modify history
alter table public.activity_log enable row level security;
create policy activity_log_select on public.activity_log for select
  using (public.current_staff_role() is not null);
create policy activity_log_insert on public.activity_log for insert
  with check (public.current_staff_role() is not null);

-- teams: public read (the /teams page); owners manage their own team
alter table public.teams enable row level security;
create policy teams_public_read on public.teams for select using (true);
create policy teams_insert on public.teams for insert
  with check (auth.uid() = owner_user_id);
create policy teams_owner_manage on public.teams for update
  using (auth.uid() = owner_user_id or public.current_staff_role() in ('sudo_admin', 'manager'))
  with check (auth.uid() = owner_user_id or public.current_staff_role() in ('sudo_admin', 'manager'));
create policy teams_owner_delete on public.teams for delete
  using (auth.uid() = owner_user_id or public.current_staff_role() = 'sudo_admin');

-- team_players: public read; the team's owner (or admin) manages the roster
alter table public.team_players enable row level security;
create policy team_players_public_read on public.team_players for select using (true);
create policy team_players_write on public.team_players for all
  using (
    exists (select 1 from public.teams t where t.id = team_id and t.owner_user_id = auth.uid())
    or public.current_staff_role() in ('sudo_admin', 'manager')
  )
  with check (
    exists (select 1 from public.teams t where t.id = team_id and t.owner_user_id = auth.uid())
    or public.current_staff_role() in ('sudo_admin', 'manager')
  );

-- matches / match_events: public read; all staff roles write (operational, no money)
alter table public.matches enable row level security;
create policy matches_public_read on public.matches for select using (true);
create policy matches_staff_write on public.matches for all
  using (public.current_staff_role() is not null)
  with check (public.current_staff_role() is not null);

alter table public.match_events enable row level security;
create policy match_events_public_read on public.match_events for select using (true);
create policy match_events_staff_write on public.match_events for all
  using (public.current_staff_role() is not null)
  with check (public.current_staff_role() is not null);

-- expenses: financial — sudo_admin + manager only; stuff denied entirely
alter table public.expenses enable row level security;
create policy expenses_financial on public.expenses for all
  using (public.current_staff_role() in ('sudo_admin', 'manager'))
  with check (public.current_staff_role() in ('sudo_admin', 'manager'));

commit;
