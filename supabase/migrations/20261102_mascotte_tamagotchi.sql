-- =============================================================================
-- Huddle — update of 02/11/2026: taking care of the group's mascot (a tiny tamagotchi)
-- For a Supabase project that already ran 20261101_mascotte_condivisione.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- ---------- Table ----------

-- When the mascot last ate and played, and who gave it: one row per group. The bars (lib/mascot.ts)
-- empty in a day from these times, so nothing has to run on the server. It never dies: empty bars only
-- make it sad.
create table if not exists public.mascot_care (
  group_id   uuid primary key references public.groups (id) on delete cascade,
  fed_at     timestamptz,
  fed_by     uuid references public.users (id) on delete set null,
  played_at  timestamptz,
  played_by  uuid references public.users (id) on delete set null
);

-- No policies: read through mascot_status(), written through care_for_mascot(), no direct access
alter table public.mascot_care enable row level security;

-- ---------- Functions ----------

-- The mascot's care for whoever sees the group: times and the first name of who gave it
create or replace function public.mascot_status(gid uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'fed_at', c.fed_at,
    'fed_by', split_part(f.full_name, ' ', 1),
    'played_at', c.played_at,
    'played_by', split_part(p.full_name, ' ', 1)
  )
  from public.mascot_care c
  left join public.users f on f.id = c.fed_by
  left join public.users p on p.id = c.played_by
  where c.group_id = gid and public.can_see_group(gid);
$$;

-- A member feeds the mascot or plays with it ('feed' | 'play'); returns the new status
create or replace function public.care_for_mascot(gid uuid, what text)
returns json language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(gid) then
    raise exception 'Solo chi è nel gruppo può prendersi cura della mascotte';
  end if;
  if what not in ('feed', 'play') then
    raise exception 'Azione sconosciuta: %', what;
  end if;
  insert into public.mascot_care (group_id) values (gid) on conflict (group_id) do nothing;
  if what = 'feed' then
    update public.mascot_care set fed_at = now(), fed_by = (select auth.uid()) where group_id = gid;
  else
    update public.mascot_care set played_at = now(), played_by = (select auth.uid()) where group_id = gid;
  end if;
  return public.mascot_status(gid);
end;
$$;

revoke execute on function public.mascot_status(uuid), public.care_for_mascot(uuid, text) from public, anon;
grant execute on function public.mascot_status(uuid), public.care_for_mascot(uuid, text) to authenticated;
