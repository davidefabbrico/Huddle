-- =============================================================================
-- Huddle — update of 03/11/2026: the people who run a venue ("Lavoro qui", the venue approves) and
-- the public profile of a person (bio, best rank, reliability, interests, unlocked achievements).
-- For a Supabase project that already ran 20261102_profilo_interessi_blocchi_gruppi.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

alter type public.notification_type add value if not exists 'staff';

-- ---------- A venue's staff ----------

-- A person asks "Lavoro qui" on a venue's page (pending); the venue approves. The staff is shown on
-- the venue's page and on the person's profile, and can organize events for the venue.
create table if not exists public.venue_staff (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.venue_staff enable row level security;

-- Approved staff of a venue (the caller)
create or replace function public.is_venue_staff(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.venue_staff s
    where s.group_id = gid and s.user_id = (select auth.uid()) and s.status = 'approved'
  );
$$;

-- Who can organize in a group: its members, and the approved staff of a venue
create or replace function public.can_organize(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_group_member(gid) or public.is_venue_staff(gid);
$$;

drop policy if exists "venue_staff: read" on public.venue_staff;
create policy "venue_staff: read" on public.venue_staff
  -- the approved staff: whoever sees the venue; requests: the person and the venue
  for select to authenticated using (
    (status = 'approved' and public.can_see_group(group_id))
    or user_id = (select auth.uid())
    or public.is_group_admin(group_id)
  );
drop policy if exists "venue_staff: ask" on public.venue_staff;
create policy "venue_staff: ask" on public.venue_staff
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.groups g where g.id = group_id and g.is_business and g.suspended_at is null)
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.account_type = 'person')
  );
drop policy if exists "venue_staff: venue approves" on public.venue_staff;
create policy "venue_staff: venue approves" on public.venue_staff
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
drop policy if exists "venue_staff: leave or remove" on public.venue_staff;
create policy "venue_staff: leave or remove" on public.venue_staff
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

-- Notifications: the venue hears of a request, the person of the approval
create or replace function public.notify_venue_staff()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  venue record;
  person text;
begin
  select g.id, g.name, g.admin_id into venue from public.groups g where g.id = new.group_id;
  select u.full_name into person from public.users u where u.id = new.user_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, body, group_id)
    values (venue.admin_id, 'staff', person || ' dice di lavorare da voi', 'Approvalo/a dalla pagina del locale.', venue.id);
  elsif new.status = 'approved' and old.status <> 'approved' then
    insert into public.notifications (user_id, type, title, body, group_id)
    values (new.user_id, 'staff', 'Ora sei nello staff di ' || venue.name, 'Puoi organizzare eventi a nome del locale.', venue.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_venue_staff_change on public.venue_staff;
create trigger on_venue_staff_change
  after insert or update of status on public.venue_staff
  for each row execute function public.notify_venue_staff();

-- Organizing: members, and the staff of a venue
drop policy if exists "events: member organizes" on public.events;
create policy "events: member organizes" on public.events
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_organize(group_id) and series_id is null);
drop policy if exists "events: organizer or admin update" on public.events;
create policy "events: organizer or admin update" on public.events
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  with check (public.can_organize(group_id) or public.is_group_admin(group_id));
drop policy if exists "event_series: member creates" on public.event_series;
create policy "event_series: member creates" on public.event_series
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_organize(group_id) and generated_until is null);
drop policy if exists "event_series: creator or admin update" on public.event_series;
create policy "event_series: creator or admin update" on public.event_series
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  with check (public.can_organize(group_id) or public.is_group_admin(group_id));

-- ---------- A person's public profile ----------

-- What others see of a person: name, photo, bio, badges, interests, when they joined; their points
-- (reliability), the most events they went to in one group (best rank) and the counts behind the
-- achievements. Only counts: never which events, groups, places or times. Nothing if you blocked each
-- other. Hours in Italian time (the achievements "Mattiniero", "Nottambulo"…).
create or replace function public.public_profile(uid uuid)
returns json language sql stable security definer set search_path = '' as $$
  with attended as (
    select e.id, e.group_id, e.kind, e.series_id, (e.date_time at time zone 'Europe/Rome') as local
    from public.event_attendees a
    join public.events e on e.id = a.event_id
    where a.user_id = uid and (a.status = 'going' or a.checked_in) and e.date_time <= now() and e.cancelled_at is null
  )
  select json_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'bio', u.bio,
    'avatar_url', u.avatar_url,
    'avatar_seed', u.avatar_seed,
    'is_relocated', u.is_relocated,
    'relocated_at', u.relocated_at,
    'interests', u.interests,
    'account_type', u.account_type,
    'created_at', u.created_at,
    'points', public.earned_points(u.id),
    'best_group_events', coalesce((select max(n) from (select count(*) as n from attended group by group_id) per_group), 0),
    'facts', json_build_object(
      'attended', (select count(*) from attended),
      'organized', (select count(*) from public.events e
                    where e.created_by = uid and e.series_id is null and e.cancelled_at is null and e.date_time <= now()),
      'thanks_received', (select count(*) from public.thanks t where t.to_user = uid),
      'thanks_sent', (select count(*) from public.thanks t where t.from_user = uid),
      'passengers', (select count(*) from public.event_attendees p join public.events e on e.id = p.event_id
                     where p.ride_with = uid and p.ride_status = 'accepted' and (p.status = 'going' or p.checked_in)
                       and e.date_time <= now() and e.cancelled_at is null),
      'groups', (select count(*) from public.group_members m where m.user_id = uid),
      'founder', exists (select 1 from public.group_members m where m.user_id = uid and m.role = 'admin'),
      'morning', (select count(*) from attended where extract(hour from local) >= 5 and extract(hour from local) < 10),
      'night', (select count(*) from attended where extract(hour from local) >= 21 or extract(hour from local) < 5),
      'after_midnight', (select count(*) from attended where extract(hour from local) < 4),
      'trips', (select count(*) from attended where kind = 'trip'),
      'weekends', (select count(*) from attended where extract(isodow from local) >= 6),
      'leap_day', exists (select 1 from attended where extract(month from local) = 2 and extract(day from local) = 29),
      'max_series', coalesce((select max(n) from (select count(*) as n from attended where series_id is not null group by series_id) s), 0)
    )
  )
  from public.users u
  where u.id = uid and uid not in (select public.hidden_users());
$$;

revoke execute on function public.is_venue_staff(uuid), public.can_organize(uuid), public.public_profile(uuid) from public, anon;
grant execute on function public.is_venue_staff(uuid), public.can_organize(uuid), public.public_profile(uuid) to authenticated;
