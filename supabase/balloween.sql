-- Balloween volleyball tournament — run once in the Supabase dashboard → SQL Editor → New query → Run.
-- Three tables, all keyed by `t` ('live' for the real tournament, 'test' for whatisjamesdoing.com/Balloween/Test).
-- The site is static, so these tables are open to the public key; the admin password is a UI gate only.

create table if not exists public.bw_teams (
  id         uuid primary key default gen_random_uuid(),
  t          text not null,
  format     text not null check (format in ('men', 'women')),
  player1    text not null,
  player2    text not null,
  name       text not null,
  pool       text,
  seed       integer,
  created_at timestamptz not null default now()
);

create table if not exists public.bw_matches (
  id         uuid primary key default gen_random_uuid(),
  t          text not null,
  format     text not null check (format in ('men', 'women')),
  key        text not null,                 -- e.g. men-pool-A-1, men-wb-2-0, men-lb-3-1, men-gf, men-gf2
  stage      text not null,                 -- pool | wb | lb | gf | gf2
  round      integer not null default 1,
  slot       integer not null default 0,
  pool       text,
  net        text,                          -- M1..M4 / W1..W4
  team_a     uuid references public.bw_teams (id) on delete set null,
  team_b     uuid references public.bw_teams (id) on delete set null,
  src_a      jsonb,                         -- {"type":"seed","seed":1} | {"type":"winner","key":...} | {"type":"loser","key":...}
  src_b      jsonb,
  sets       jsonb not null default '[]',   -- [[21,18]] or [[15,11],[12,15],[15,9]]
  winner     uuid references public.bw_teams (id) on delete set null,
  void       boolean not null default false, -- both sides were byes; nothing to play
  ready_at   timestamptz,                   -- when both teams became known (net queue order)
  updated_at timestamptz not null default now(),
  unique (t, key)
);

create table if not exists public.bw_state (
  t          text not null,
  format     text not null check (format in ('men', 'women')),
  phase      text not null default 'setup', -- setup | pools | preview | playoffs
  pool_cap   integer,                      -- pool games are one set to this score, hard cap (null = 21)
  updated_at timestamptz not null default now(),
  primary key (t, format)
);
-- Added Oct 20, 2026: safe to re-run on an existing database.
alter table public.bw_state add column if not exists pool_cap integer;

create index if not exists bw_teams_t_idx   on public.bw_teams (t, format);
create index if not exists bw_matches_t_idx on public.bw_matches (t, format);

-- Open access (public key). Drop + recreate so re-running this file is safe.
alter table public.bw_teams   enable row level security;
alter table public.bw_matches enable row level security;
alter table public.bw_state   enable row level security;
drop policy if exists "balloween open" on public.bw_teams;
drop policy if exists "balloween open" on public.bw_matches;
drop policy if exists "balloween open" on public.bw_state;
create policy "balloween open" on public.bw_teams   for all to anon, authenticated using (true) with check (true);
create policy "balloween open" on public.bw_matches for all to anon, authenticated using (true) with check (true);
create policy "balloween open" on public.bw_state   for all to anon, authenticated using (true) with check (true);

-- Live updates on phones: realtime needs the tables in the publication and full replica identity for deletes.
alter table public.bw_teams   replica identity full;
alter table public.bw_matches replica identity full;
alter table public.bw_state   replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.bw_teams;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.bw_matches;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.bw_state;
exception when duplicate_object then null; end $$;
