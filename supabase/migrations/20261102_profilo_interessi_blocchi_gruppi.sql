-- =============================================================================
-- Huddle — update of 02/11/2026: no more mascot and clan; interests become categories (with "Altro");
-- Huddle is 18+; a short onboarding after signup; blocking, hiding, reporting and suspending; a whole
-- group can join an event.
-- For a Supabase project that already ran 20261101_mascotte_condivisione.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

alter type public.notification_type add value if not exists 'group_event';

-- ---------- No more mascot and clan ----------

-- (also the tamagotchi, if its draft script was run)
drop function if exists public.care_for_mascot(uuid, text);
drop function if exists public.mascot_status(uuid);
drop table if exists public.mascot_care;
drop function if exists public.group_level(uuid);
alter table public.groups drop constraint if exists groups_mascot_check;
alter table public.groups drop column if exists mascot;

-- ---------- Interests: categories (lib/interests.ts) ----------

-- The old specific interests become their category; anything else (written with "Altro") stays
create or replace function pg_temp.to_categories(old text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select case t
      when 'running' then 'sport' when 'padel' then 'sport'
      when 'hiking' then 'natura'
      when 'aperitivo' then 'cibo' when 'cucina' then 'cibo'
      when 'giochi da tavolo' then 'giochi'
      when 'musica live' then 'musica'
      when 'yoga' then 'benessere'
      else t end as x
    from unnest(old) as t
  ) s;
$$;
update public.users set interests = pg_temp.to_categories(interests) where interests <> '{}';
update public.groups set tags = pg_temp.to_categories(tags) where tags <> '{}';
update public.events set tags = pg_temp.to_categories(tags) where tags <> '{}';
update public.event_series set tags = pg_temp.to_categories(tags) where tags <> '{}';

-- ---------- 18+ and onboarding ----------

-- When the person declared to be 18 or older (signup); people who signed up before have none
alter table public.users add column if not exists adult_confirmed_at timestamptz;
-- When the onboarding (interests, about you) was done; people who signed up before skip it
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'onboarded_at') then
    alter table public.users add column onboarded_at timestamptz;
    update public.users set onboarded_at = created_at;
  end if;
end $$;

-- Groups' age range starts at 18 (the old checks go first: they have different names on older projects)
alter table public.groups drop constraint if exists groups_age_check;
alter table public.groups drop constraint if exists groups_age_min_check;
alter table public.groups drop constraint if exists groups_age_max_check;
alter table public.groups drop constraint if exists groups_check;
update public.groups
  set age_min = case when age_min < 18 then 18 else age_min end,
      age_max = case when age_max < 18 then 18 else age_max end
  where age_min < 18 or age_max < 18;
alter table public.groups add constraint groups_age_check
  check (age_min between 18 and 99 and age_max between 18 and 99 and age_min <= age_max);

-- A new account needs the 18+ declaration (the app's checkbox) and, if given, a birth year of 18+.
-- The app passes full_name/account_type/adult in signUp's options.data (the rest comes in the onboarding).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1), 'Utente');
  kind public.account_type := coalesce((meta ->> 'account_type')::public.account_type, 'person');
  year smallint := case when kind = 'person' then nullif(meta ->> 'birth_year', '')::smallint end;
begin
  if coalesce((meta ->> 'adult')::boolean, false) is not true then
    raise exception 'Per usare Huddle devi avere almeno 18 anni';
  end if;
  if year > extract(year from now())::int - 18 then
    raise exception 'Per usare Huddle devi avere almeno 18 anni';
  end if;
  insert into public.users (id, full_name, is_relocated, relocated_at, interests, account_type, adult_confirmed_at)
  values (
    new.id,
    name,
    coalesce((meta ->> 'is_relocated')::boolean, false),
    nullif(meta ->> 'relocated_at', '')::date,
    coalesce(array(select jsonb_array_elements_text(
      case when jsonb_typeof(meta -> 'interests') = 'array' then meta -> 'interests' else '[]'::jsonb end)), '{}'),
    kind,
    now()
  );
  insert into public.user_settings (user_id, birth_year) values (new.id, year);
  if kind = 'business' then
    insert into public.groups (name, description, admin_id, is_business, icon, color)
    values (name, 'Gli eventi di ' || name, new.id, true, '🎉', 'amber');
  end if;
  return new;
end;
$$;

-- A birth year that's set or changed must be of someone 18 or older
create or replace function public.check_adult_birth_year()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.birth_year is not null and (tg_op = 'INSERT' or new.birth_year is distinct from old.birth_year)
     and new.birth_year > extract(year from now())::int - 18 then
    raise exception 'Huddle è per chi ha almeno 18 anni';
  end if;
  return new;
end;
$$;

drop trigger if exists check_adult_birth_year on public.user_settings;
create trigger check_adult_birth_year
  before insert or update of birth_year on public.user_settings
  for each row execute function public.check_adult_birth_year();

-- ---------- Blocking, hiding, reporting, suspending ----------

-- You block someone: you don't see each other any more (messages, member lists, attendees)
create table if not exists public.user_blocks (
  blocker_id  uuid not null references public.users (id) on delete cascade,
  blocked_id  uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- You hide a group: it's gone from your lists, search, suggestions and events
create table if not exists public.hidden_groups (
  user_id     uuid not null references public.users (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, group_id)
);

-- "Segnala": a person or a group, with a reason. Read and handled by the app's owner in the dashboard
-- (Table Editor -> reports): set handled_at; suspend a group with groups.suspended_at, a person with
-- Authentication -> Users -> Ban user.
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references public.users (id) on delete cascade,
  user_id      uuid references public.users (id) on delete cascade,
  group_id     uuid references public.groups (id) on delete cascade,
  reason       text not null check (char_length(reason) between 1 and 500),
  created_at   timestamptz not null default now(),
  handled_at   timestamptz,
  check (num_nonnulls(user_id, group_id) = 1)
);

-- A suspended group (set by the app's owner) is invisible to everyone
alter table public.groups add column if not exists suspended_at timestamptz;

alter table public.user_blocks enable row level security;
alter table public.hidden_groups enable row level security;
alter table public.reports enable row level security;

drop policy if exists "user_blocks: own" on public.user_blocks;
create policy "user_blocks: own" on public.user_blocks
  for all to authenticated using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
drop policy if exists "hidden_groups: own" on public.hidden_groups;
create policy "hidden_groups: own" on public.hidden_groups
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "reports: send" on public.reports;
create policy "reports: send" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- The groups you hid, to show them again (Profilo -> Account): they're invisible to you otherwise
create or replace function public.my_hidden_groups()
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object('id', g.id, 'name', g.name, 'icon', g.icon, 'color', g.color) order by h.created_at), '[]'::json)
  from public.hidden_groups h join public.groups g on g.id = h.group_id
  where h.user_id = (select auth.uid());
$$;

-- The people you don't see: the ones you blocked and the ones who blocked you (without saying which)
create or replace function public.hidden_users()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select blocked_id from public.user_blocks where blocker_id = (select auth.uid())
  union
  select blocker_id from public.user_blocks where blocked_id = (select auth.uid());
$$;

-- Who sees a group: not if it's suspended; not if you hid it (unless you're in it)
create or replace function public.can_see_group(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.groups g where g.id = gid and g.suspended_at is not null)
    and (
      public.is_group_member(gid)
      or (
        -- a group you hid is gone for you (unless you're in it)
        not exists (select 1 from public.hidden_groups h where h.group_id = gid and h.user_id = (select auth.uid()))
        and (
          exists (
            select 1 from public.groups g
            where g.id = gid and (g.visibility = 'public' or g.admin_id = (select auth.uid()))
          )
          or exists (
            select 1 from public.join_requests r
            where r.group_id = gid and r.user_id = (select auth.uid()) and r.status <> 'rejected'
          )
        )
      )
    );
$$;

drop policy if exists "groups: read" on public.groups;
create policy "groups: read" on public.groups
  -- admin_id is read from the row itself: right after "create group" the helper function can't see it yet
  for select to authenticated using (
    suspended_at is null and (admin_id = (select auth.uid()) or public.can_see_group(id))
  );

-- ---------- A whole group joins an event ----------

-- The group's admin says "Ci veniamo come gruppo" to a public event of another group (or a venue):
-- every member is asked, and answers for themselves
create table if not exists public.event_groups (
  event_id    uuid not null references public.events (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  joined_by   uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (event_id, group_id)
);

alter table public.event_groups enable row level security;
drop policy if exists "event_groups: read" on public.event_groups;
create policy "event_groups: read" on public.event_groups
  for select to authenticated using (public.can_see_event(event_id));

-- Who can answer an event (and add a photo): the people of the organizing group (or anyone, for a
-- venue's events) and the members of the groups that joined it
create or replace function public.can_answer_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (
      public.can_join_event(e.group_id)
      or exists (select 1 from public.event_groups eg where eg.event_id = e.id and public.is_group_member(eg.group_id))
    )
  );
$$;

create or replace function public.join_event_as_group(eid uuid, gid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev record;
  group_name text;
begin
  if not public.is_group_admin(gid) then
    raise exception 'Solo l’admin può far partecipare il gruppo';
  end if;
  select e.title, e.group_id, e.visibility, e.cancelled_at, coalesce(e.ends_at, e.date_time) as ends, g.visibility as group_visibility
    into ev
    from public.events e join public.groups g on g.id = e.group_id
    where e.id = eid;
  if not found or not public.can_see_event(eid) then
    raise exception 'Evento non trovato';
  end if;
  if ev.group_id = gid then
    raise exception 'È già un evento del tuo gruppo';
  end if;
  if ev.visibility <> 'public' or ev.group_visibility <> 'public' then
    raise exception 'Si partecipa come gruppo solo agli eventi pubblici';
  end if;
  if ev.cancelled_at is not null or ev.ends < now() then
    raise exception 'L’evento è passato o annullato';
  end if;
  insert into public.event_groups (event_id, group_id, joined_by) values (eid, gid, (select auth.uid()))
    on conflict do nothing;
  if found then
    select name into group_name from public.groups where id = gid;
    insert into public.notifications (user_id, type, title, body, group_id, event_id)
    select m.user_id, 'group_event', group_name || ' partecipa a «' || ev.title || '»', 'Ci sei? Rispondi sull’evento.', gid, eid
    from public.group_members m
    where m.group_id = gid and m.user_id <> (select auth.uid());
  end if;
end;
$$;

create or replace function public.leave_event_as_group(eid uuid, gid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_admin(gid) then
    raise exception 'Solo l’admin può ritirare il gruppo';
  end if;
  delete from public.event_groups where event_id = eid and group_id = gid;
end;
$$;

-- The groups taking part in an event, with how many of their members are coming (counts only)
create or replace function public.event_groups_summary(eid uuid)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
    'group_id', g.id,
    'name', g.name,
    'icon', g.icon,
    'color', g.color,
    'members', (select count(*) from public.group_members m where m.group_id = g.id),
    'going', (select count(*) from public.group_members m join public.event_attendees a on a.user_id = m.user_id
              where m.group_id = g.id and a.event_id = eid and a.status = 'going'),
    'answered', (select count(*) from public.group_members m join public.event_attendees a on a.user_id = m.user_id
                 where m.group_id = g.id and a.event_id = eid)
  ) order by eg.created_at), '[]'::json)
  from public.event_groups eg
  join public.groups g on g.id = eg.group_id
  where eg.event_id = eid and public.can_see_event(eid);
$$;

-- Answers and photos: also the members of the groups that joined
drop policy if exists "event_attendees: read" on public.event_attendees;
create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (public.can_answer_event(event_id));
drop policy if exists "event_attendees: answer self" on public.event_attendees;
create policy "event_attendees: answer self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.cancelled_at is null)
    and public.can_answer_event(event_id)
    and (not checked_in or public.is_checkin_open(event_id))
  );
drop policy if exists "event_photos: add own" on public.event_photos;
create policy "event_photos: add own" on public.event_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.can_answer_event(event_id)
    and exists (select 1 from public.events e where e.id = event_id and e.date_time - interval '1 hour' <= now())
  );
drop policy if exists "event-photos: upload own" on storage.objects;
create policy "event-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-photos' and split_part(name, '/', 2) = (select auth.uid())::text and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 1) and public.can_answer_event(e.id)));

revoke execute on function
  public.hidden_users(), public.my_hidden_groups(), public.can_answer_event(uuid), public.join_event_as_group(uuid, uuid),
  public.leave_event_as_group(uuid, uuid), public.event_groups_summary(uuid)
  from public, anon;
grant execute on function
  public.hidden_users(), public.my_hidden_groups(), public.can_answer_event(uuid), public.join_event_as_group(uuid, uuid),
  public.leave_event_as_group(uuid, uuid), public.event_groups_summary(uuid)
  to authenticated;
