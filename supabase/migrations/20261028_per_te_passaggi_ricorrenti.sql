-- =============================================================================
-- Huddle — update of 28/10/2026: "Per te", rides on request, recurring events
-- For a Supabase project that already ran 20261027_private_groups.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- ---------- "Per te": event tags, hide my activity ----------

-- Hidden users are never counted in the suggestions of other people
alter table public.users add column if not exists hide_activity boolean not null default false;

-- What an event is about (from the interests list): drives the "Per te" suggestions
alter table public.events add column if not exists tags text[] not null default '{}';
alter table public.events drop constraint if exists events_tags_check;
alter table public.events add constraint events_tags_check check (cardinality(tags) <= 5);

-- ---------- Rides: departure area and time, the driver accepts ----------

do $$ begin
  create type public.ride_status as enum ('requested', 'accepted');
exception when duplicate_object then null;
end $$;

alter table public.event_attendees
  add column if not exists ride_status public.ride_status,  -- set when ride_with is set
  add column if not exists depart_area text,                -- driver: where they leave from (an area, never a live position)
  add column if not exists depart_time time;
alter table public.event_attendees drop constraint if exists event_attendees_depart_area_check;
alter table public.event_attendees add constraint event_attendees_depart_area_check check (char_length(depart_area) <= 60);

-- Rides taken before this update were immediate: they count as accepted
do $$ begin
  perform set_config('huddle.trusted', 'on', true);
  update public.event_attendees set ride_status = 'accepted' where ride_with is not null and ride_status is null;
end $$;

-- ---------- Recurring events ----------

-- "Palestra lun, mer, ven alle 19": the series creates its occurrences (normal events) two weeks ahead
create table if not exists public.event_series (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups (id) on delete cascade,
  created_by       uuid references public.users (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 150),
  weekdays         smallint[] not null
                   check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]),  -- 1 = Monday
  start_time       time not null,
  timezone         text not null default 'Europe/Rome',
  location         text not null default '',
  lat              double precision check (lat between -90 and 90),
  lon              double precision check (lon between -180 and 180),
  tags             text[] not null default '{}' check (cardinality(tags) <= 5),
  generated_until  date,  -- occurrences exist up to this day: a deleted occurrence is not created again
  created_at       timestamptz not null default now()
);
create index if not exists event_series_group_idx on public.event_series (group_id);

alter table public.events add column if not exists series_id uuid references public.event_series (id) on delete set null;
do $$ begin
  alter table public.events add constraint events_series_time_key unique (series_id, date_time);
exception when duplicate_table or duplicate_object then null;
end $$;

-- "Ci sono ogni volta": the regulars are added to each new occurrence with their usual choices
-- (car and seats, departure, the driver who accepted them). Written only by set_regular/answer_ride.
create table if not exists public.series_regulars (
  series_id    uuid not null references public.event_series (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  transport    public.transport,
  seats        smallint not null default 0 check (seats between 0 and 8),
  depart_area  text check (char_length(depart_area) <= 60),
  depart_time  time,
  ride_with    uuid references public.users (id) on delete set null,
  primary key (series_id, user_id),
  check (ride_with is distinct from user_id)
);

-- ---------- Functions ----------

-- First rank: generic, not only for people who moved. Keep in sync with lib/ranks.ts.
create or replace function public.rank_name(attended integer)
returns text language sql immutable set search_path = '' as $$
  select case
    when attended >= 15 then 'Leggenda vivente 👑'
    when attended >= 10 then 'Colonna portante 🏛️'
    when attended >= 6  then 'Anima della festa 🎉'
    when attended >= 3  then 'Prezzemolo 🌿'
    when attended >= 1  then 'Faccia nota 👋'
    else 'Volto nuovo 🌱'
  end;
$$;

-- New event: the organizer is automatically "Ci sono", the other members get a notification.
-- Occurrences of a recurring event skip both: the regulars are added instead, and the members
-- were notified once, when the series was created.
create or replace function public.handle_new_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.series_id is not null then
    return new;
  end if;
  if new.created_by is not null then
    insert into public.event_attendees (event_id, user_id, status)
    values (new.id, new.created_by, 'going')
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select m.user_id, 'new_event', 'Nuovo evento', g.name || ': ' || new.title, g.id, new.id
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.group_id = new.group_id and m.user_id is distinct from new.created_by;
  return new;
end;
$$;

-- Keep attendee rows consistent: a check-in can't be undone and always means "Ci sono".
-- Rides: choosing a driver is a request; only the driver accepts it (answer_ride, which runs
-- with huddle.trusted = on, like the recurring events that add the regulars).
create or replace function public.normalize_attendee()
returns trigger language plpgsql set search_path = '' as $$
declare
  trusted boolean := coalesce(current_setting('huddle.trusted', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and old.checked_in then
    new.checked_in := true;
  end if;
  if new.checked_in then
    new.status := 'going';
  end if;
  if new.status = 'not_going' then
    new.transport := null;
  end if;
  if new.transport is distinct from 'need_ride' then
    new.ride_with := null;
  end if;
  if new.transport is distinct from 'car' then
    new.seats := 0;
    new.depart_area := null;
    new.depart_time := null;
  end if;
  new.depart_area := nullif(trim(new.depart_area), '');
  if new.ride_with is null then
    new.ride_status := null;
  elsif not trusted then
    if tg_op = 'INSERT' or new.ride_with is distinct from old.ride_with then
      new.ride_status := 'requested';
    elsif new.ride_status is distinct from old.ride_status then
      new.ride_status := old.ride_status;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A passenger can only ask someone who drives to this event and still has a free seat
create or replace function public.check_ride()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  driver_seats smallint;
  taken integer;
begin
  if new.ride_with is null or (tg_op = 'UPDATE' and new.ride_with is not distinct from old.ride_with) then
    return new;
  end if;
  select seats into driver_seats from public.event_attendees
  where event_id = new.event_id and user_id = new.ride_with and status = 'going' and transport = 'car';
  if driver_seats is null then
    raise exception 'Questa persona non viene in auto';
  end if;
  select count(*) into taken from public.event_attendees
  where event_id = new.event_id and ride_with = new.ride_with and ride_status = 'accepted' and user_id <> new.user_id;
  if taken >= driver_seats then
    raise exception 'Non ci sono più posti in quest''auto';
  end if;
  return new;
end;
$$;

-- When a driver stops driving (or says "Non ci sono"), their passengers are free again;
-- when someone asks for a ride, the driver gets a notification
create or replace function public.handle_ride_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.transport = 'car' and new.transport is distinct from 'car' then
    update public.event_attendees set ride_with = null
    where event_id = new.event_id and ride_with = new.user_id;
    delete from public.car_spots where event_id = new.event_id and user_id = new.user_id;
  end if;
  if new.ride_status = 'requested' and (tg_op = 'INSERT' or new.ride_with is distinct from old.ride_with) then
    insert into public.notifications (user_id, type, title, body, group_id, event_id)
    select new.ride_with, 'ride', u.full_name || ' ti chiede un passaggio 🚗', 'Per «' || e.title || '»: rispondi dall''evento', e.group_id, e.id
    from public.users u, public.events e
    where u.id = new.user_id and e.id = new.event_id;
  end if;
  return new;
end;
$$;

-- A driver who removes their answer frees their passengers and stops sharing the car
create or replace function public.handle_attendee_removed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.event_attendees set ride_with = null where event_id = old.event_id and ride_with = old.user_id;
  delete from public.car_spots where event_id = old.event_id and user_id = old.user_id;
  return old;
end;
$$;

-- Driver: accept or decline a ride request. Accepting a regular of a recurring event makes it
-- their usual ride: the next occurrences start with it.
create or replace function public.answer_ride(p_event uuid, p_passenger uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  driver_seats smallint;
  taken integer;
  ev public.events;
  driver_name text;
begin
  if not exists (
    select 1 from public.event_attendees
    where event_id = p_event and user_id = p_passenger and ride_with = me and ride_status = 'requested'
  ) then
    raise exception 'Richiesta di passaggio non trovata';
  end if;
  perform set_config('huddle.trusted', 'on', true);
  select * into ev from public.events where id = p_event;
  select full_name into driver_name from public.users where id = me;

  if p_accept then
    select seats into driver_seats from public.event_attendees
    where event_id = p_event and user_id = me and status = 'going' and transport = 'car';
    select count(*) into taken from public.event_attendees
    where event_id = p_event and ride_with = me and ride_status = 'accepted';
    if taken >= coalesce(driver_seats, 0) then
      raise exception 'Non ci sono più posti in quest''auto';
    end if;
    update public.event_attendees set ride_status = 'accepted' where event_id = p_event and user_id = p_passenger;
    if ev.series_id is not null then
      update public.series_regulars set ride_with = me
      where series_id = ev.series_id and user_id = p_passenger and transport = 'need_ride';
    end if;
    insert into public.notifications (user_id, type, title, body, group_id, event_id)
    values (p_passenger, 'ride', driver_name || ' ti dà un passaggio 🚗', 'Per «' || ev.title || '»', ev.group_id, ev.id);
  else
    update public.event_attendees set ride_with = null where event_id = p_event and user_id = p_passenger;
    insert into public.notifications (user_id, type, title, body, group_id, event_id)
    values (p_passenger, 'ride', 'Passaggio non disponibile', driver_name || ' non può darti un passaggio per «' || ev.title || '»', ev.group_id, ev.id);
  end if;
end;
$$;

-- Series: check the time zone, make the creator a regular, notify the members once
create or replace function public.normalize_series()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform now() at time zone new.timezone;  -- raises on an unknown time zone
  new.title := trim(new.title);
  new.location := trim(new.location);
  return new;
end;
$$;

create or replace function public.handle_new_series()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.series_regulars (series_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  end if;
  insert into public.notifications (user_id, type, title, body, group_id)
  select m.user_id, 'new_event', 'Nuovo evento ricorrente 🔁', g.name || ': ' || new.title || ', ogni settimana', g.id
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.group_id = new.group_id and m.user_id is distinct from new.created_by;
  return new;
end;
$$;

-- Adds the regulars (all, or only p_user) to an occurrence they haven't answered yet:
-- drivers first, then passengers in their usual car while it has free seats. Internal.
create or replace function public.apply_regulars(p_event uuid, p_user uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  r public.series_regulars;
  free_seats integer;
begin
  select * into ev from public.events where id = p_event;
  perform set_config('huddle.trusted', 'on', true);
  for r in
    select * from public.series_regulars
    where series_id = ev.series_id and (p_user is null or user_id = p_user)
    order by (transport = 'car') desc nulls last, user_id
  loop
    continue when exists (select 1 from public.event_attendees where event_id = p_event and user_id = r.user_id);
    -- only people who can still come: members, guests and accepted requesters
    continue when not (
      exists (select 1 from public.group_members where group_id = ev.group_id and user_id = r.user_id)
      or exists (select 1 from public.join_requests where group_id = ev.group_id and user_id = r.user_id and status in ('guest', 'accepted'))
    );
    select a.seats - (
        select count(*) from public.event_attendees p
        where p.event_id = p_event and p.ride_with = a.user_id and p.ride_status = 'accepted'
      )
      into free_seats
    from public.event_attendees a
    where a.event_id = p_event and a.user_id = r.ride_with and a.status = 'going' and a.transport = 'car';
    insert into public.event_attendees (event_id, user_id, status, transport, seats, depart_area, depart_time, ride_with, ride_status)
    values (
      p_event, r.user_id, 'going', r.transport, r.seats, r.depart_area, r.depart_time,
      case when coalesce(free_seats, 0) > 0 then r.ride_with end,
      case when coalesce(free_seats, 0) > 0 then 'accepted'::public.ride_status end
    );
  end loop;
end;
$$;

-- Creates the occurrences of the next 14 days for your groups' series (all, or p_series).
-- With p_user = you: also adds you, as a regular, to the next occurrences you haven't answered.
-- Called by the app when it lists events: no scheduled job needed.
create or replace function public.extend_series(p_series uuid default null, p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s public.event_series;
  today date;
  d date;
  starts timestamptz;
  new_id uuid;
  created integer := 0;
begin
  if me is null then
    return 0;
  end if;
  for s in
    select * from public.event_series x
    where (p_series is null or x.id = p_series) and public.can_access_chat(x.group_id)
  loop
    today := (now() at time zone s.timezone)::date;
    d := greatest(today, coalesce(s.generated_until + 1, today));
    while d <= today + 13 loop
      if extract(isodow from d)::smallint = any (s.weekdays) then
        starts := (d + s.start_time) at time zone s.timezone;
        if starts > now() then
          insert into public.events (group_id, created_by, title, date_time, location, lat, lon, tags, series_id)
          values (s.group_id, s.created_by, s.title, starts, s.location, s.lat, s.lon, s.tags, s.id)
          on conflict (series_id, date_time) do nothing
          returning id into new_id;
          if new_id is not null then
            created := created + 1;
            perform public.apply_regulars(new_id);
          end if;
        end if;
      end if;
      d := d + 1;
    end loop;
    update public.event_series set generated_until = today + 13 where id = s.id;

    if p_user = me then
      for new_id in select e.id from public.events e where e.series_id = s.id and e.date_time > now() loop
        perform public.apply_regulars(new_id, me);
      end loop;
    end if;
  end loop;
  return created;
end;
$$;

-- "Ci sono ogni volta" from an occurrence: your choices there (car, seats, departure, the driver
-- who accepted you) become your usual ones: they're copied to the next occurrences where you're
-- in, and you're added to the ones you haven't answered
create or replace function public.set_regular(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ev public.events;
  mine public.event_attendees;
begin
  select * into ev from public.events where id = p_event;
  if ev.series_id is null or not public.can_access_chat(ev.group_id) then
    raise exception 'Questo evento non si ripete';
  end if;
  select * into mine from public.event_attendees where event_id = p_event and user_id = me and status = 'going';
  insert into public.series_regulars (series_id, user_id, transport, seats, depart_area, depart_time, ride_with)
  values (
    ev.series_id, me, mine.transport, coalesce(mine.seats, 0), mine.depart_area, mine.depart_time,
    case when mine.ride_status = 'accepted' then mine.ride_with end
  )
  on conflict (series_id, user_id) do update set
    transport = excluded.transport, seats = excluded.seats, depart_area = excluded.depart_area,
    depart_time = excluded.depart_time, ride_with = excluded.ride_with;

  update public.event_attendees a
  set transport = mine.transport, seats = coalesce(mine.seats, 0), depart_area = mine.depart_area, depart_time = mine.depart_time
  from public.events e
  where a.event_id = e.id and e.series_id = ev.series_id and e.date_time > ev.date_time
    and a.user_id = me and a.status = 'going' and not a.checked_in;
  perform public.extend_series(ev.series_id, me);
end;
$$;

-- "Non più ogni volta": you're no longer a regular, and your answers to the occurrences after
-- this one go away (unless you already checked in)
create or replace function public.remove_regular(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ev public.events;
begin
  select * into ev from public.events where id = p_event;
  if ev.series_id is null then
    return;
  end if;
  delete from public.series_regulars where series_id = ev.series_id and user_id = me;
  delete from public.event_attendees a
  using public.events e
  where a.event_id = e.id and e.series_id = ev.series_id and e.date_time > ev.date_time
    and a.user_id = me and not a.checked_in;
end;
$$;

-- "Per te": counts only, never names. For each upcoming event you can see: how many people from
-- your groups, with your interests, or new in town are going. Plus what your groups like (their
-- interests and the tags of the events they went to) and the tags of the events you went to.
-- People with hide_activity are left out.
create or replace function public.for_you_signals()
returns json language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.interests from public.users u where u.id = (select auth.uid())
  ),
  mates as (
    select distinct m2.user_id
    from public.group_members m1
    join public.group_members m2 on m2.group_id = m1.group_id and m2.user_id <> m1.user_id
    where m1.user_id = (select auth.uid())
  ),
  going as (
    select a.event_id,
      exists (select 1 from mates where mates.user_id = a.user_id) as is_mate,
      u.interests && (select interests from me) as is_similar,
      u.is_relocated
    from public.event_attendees a
    join public.events e on e.id = a.event_id
    join public.users u on u.id = a.user_id
    where a.status = 'going' and a.user_id <> (select auth.uid()) and not u.hide_activity
      and e.date_time > now() and public.can_see_group(e.group_id)
  ),
  taste as (
    select t.tag, count(*)::int as weight from (
      select unnest(u.interests) as tag from public.users u join mates on mates.user_id = u.id
      union all
      select unnest(e.tags) from public.event_attendees a
      join mates on mates.user_id = a.user_id
      join public.users u on u.id = a.user_id and not u.hide_activity
      join public.events e on e.id = a.event_id
      where a.status = 'going' and e.date_time between now() - interval '90 days' and now()
    ) t
    group by t.tag
  ),
  mine as (
    select tag, count(*)::int as weight
    from public.event_attendees a
    join public.events e on e.id = a.event_id
    cross join lateral unnest(e.tags) as tag
    where a.user_id = (select auth.uid()) and a.status = 'going' and e.date_time < now()
    group by tag
  )
  select json_build_object(
    'events', coalesce((
      select json_agg(x) from (
        select event_id,
          (count(*) filter (where is_mate))::int as mates_going,
          (count(*) filter (where is_similar))::int as similar_going,
          (count(*) filter (where is_relocated))::int as newcomers_going
        from going
        group by event_id
      ) x
    ), '[]'::json),
    'taste', coalesce((select json_object_agg(tag, weight) from taste), '{}'::json),
    'mine', coalesce((select json_object_agg(tag, weight) from mine), '{}'::json)
  );
$$;

-- ---------- Triggers ----------

drop trigger if exists after_attendee_removed on public.event_attendees;
create trigger after_attendee_removed
  after delete on public.event_attendees
  for each row execute function public.handle_attendee_removed();

drop trigger if exists before_series_change on public.event_series;
create trigger before_series_change
  before insert or update on public.event_series
  for each row execute function public.normalize_series();

drop trigger if exists on_series_created on public.event_series;
create trigger on_series_created
  after insert on public.event_series
  for each row execute function public.handle_new_series();

-- ---------- Row Level Security ----------

alter table public.event_series    enable row level security;
alter table public.series_regulars enable row level security;

-- Events: occurrences of a series are created only by extend_series
drop policy if exists "events: member organizes" on public.events;
create policy "events: member organizes" on public.events
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_group_member(group_id) and series_id is null);

-- car_spots: passengers see the car only once the driver accepted them
drop policy if exists "car_spots: driver and passengers" on public.car_spots;
create policy "car_spots: driver and passengers" on public.car_spots
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and now() < e.date_time + interval '12 hours')
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.event_attendees a
        where a.event_id = car_spots.event_id and a.user_id = (select auth.uid())
          and a.ride_with = car_spots.user_id and a.ride_status = 'accepted'
      )
    )
  );

-- event_series: seen like the group's events; any member creates one; the creator or the admin
-- changes or stops it
drop policy if exists "event_series: read" on public.event_series;
create policy "event_series: read" on public.event_series
  for select to authenticated using (public.can_see_group(group_id));
drop policy if exists "event_series: member creates" on public.event_series;
create policy "event_series: member creates" on public.event_series
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_group_member(group_id) and generated_until is null);
drop policy if exists "event_series: creator or admin update" on public.event_series;
create policy "event_series: creator or admin update" on public.event_series
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  with check (public.is_group_member(group_id) or public.is_group_admin(group_id));
drop policy if exists "event_series: creator or admin delete" on public.event_series;
create policy "event_series: creator or admin delete" on public.event_series
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id));

-- series_regulars: visible to people with access to the group; written by set_regular/answer_ride
drop policy if exists "series_regulars: read" on public.series_regulars;
create policy "series_regulars: read" on public.series_regulars
  for select to authenticated using (
    exists (select 1 from public.event_series s where s.id = series_id and public.can_access_chat(s.group_id))
  );

-- ---------- Who can call the functions ----------

revoke execute on function public.apply_regulars(uuid, uuid) from public, anon, authenticated;
revoke execute on function
  public.answer_ride(uuid, uuid, boolean), public.extend_series(uuid, uuid), public.set_regular(uuid),
  public.remove_regular(uuid), public.for_you_signals()
  from public, anon;
grant execute on function
  public.answer_ride(uuid, uuid, boolean), public.extend_series(uuid, uuid), public.set_regular(uuid),
  public.remove_regular(uuid), public.for_you_signals()
  to authenticated;
