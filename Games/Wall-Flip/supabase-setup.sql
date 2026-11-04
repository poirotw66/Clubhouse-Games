-- Wall-Flip online leaderboard schema + access rules (Supabase).
-- Run once in the Supabase SQL Editor of your project (e.g. jktcwagiflldtzirzcni).

create table if not exists public.wallflip_scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 10),
  score      integer     not null check (score between 0 and 5000),
  rolls      integer     not null default 0 check (rolls between 0 and 99),
  course     integer     not null default 0 check (course between 0 and 9),
  time_sec   numeric     not null check (time_sec >= 0),
  created_at timestamptz not null default now()
);

alter table public.wallflip_scores enable row level security;

-- anyone (anon) may read the leaderboard ...
create policy "wallflip read" on public.wallflip_scores
  for select to anon using (true);

-- ... and insert a score row satisfying constraints (append-only)
create policy "wallflip insert" on public.wallflip_scores
  for insert to anon with check (true);

-- fast index for course leaderboard sorted by score desc, time_sec asc
create index if not exists wallflip_scores_course_score_idx
  on public.wallflip_scores (course, score desc, time_sec asc);
