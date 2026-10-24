-- Clip-Clop online leaderboard schema + access rules (Supabase).
-- Run once in the Supabase SQL Editor of a fresh project.

create table if not exists public.clipclop_scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 10),
  time_ms    integer     not null check (time_ms between 5000 and 900000),
  falls      integer     not null default 0 check (falls between 0 and 999),
  steps      integer     not null default 0 check (steps between 0 and 99999),
  speed      integer     not null default 0 check (speed between 0 and 500),  -- 0.1 km/h units
  code       text        not null check (code like 'CC%' and char_length(code) <= 2500),
  created_at timestamptz not null default now()
);

alter table public.clipclop_scores enable row level security;

-- anyone (anon) may read the board ...
create policy "clipclop read" on public.clipclop_scores
  for select to anon using (true);

-- ... and insert a row that satisfies the table constraints above.
-- No anon update/delete: entries are append-only.
create policy "clipclop insert" on public.clipclop_scores
  for insert to anon with check (true);

-- helpful index for the default view (fastest first)
create index if not exists clipclop_scores_time_idx
  on public.clipclop_scores (time_ms asc);
