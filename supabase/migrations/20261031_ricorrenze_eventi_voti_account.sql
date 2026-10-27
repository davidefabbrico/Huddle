-- =============================================================================
-- Huddle — update of 31/10/2026: recurring events with start and end date, public/private events,
-- editing and cancelling events, votes on the holiday plan, deleting your account
-- For a Supabase project that already ran 20261030_cerca_eta_affidabilita_locali.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- New notification: an event you're going to changed (date, place) or was cancelled
alter type public.notification_type add value if not exists 'event_update';

-- ---------- Columns ----------

-- Events (and holidays) can be private: only the group's members and guests see them
do $$ begin
  create type public.event_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;
alter table public.events
  add column if not exists visibility public.event_visibility not null default 'public',
  add column if not exists cancelled_at timestamptz;  -- "Annullato": stays visible, nobody can answer

-- Recurring events run from a first to a last day (at most a year; the last day can be moved).
-- Older series (no end) keep creating dates four weeks ahead.
alter table public.event_series
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists visibility public.event_visibility not null default 'public';
update public.event_series set starts_on = created_at::date where starts_on is null;
alter table public.event_series drop constraint if exists event_series_range_check;
alter table public.event_series add constraint event_series_range_check
  check (ends_on is null or (starts_on is not null and ends_on >= starts_on and ends_on <= starts_on + 366));

-- ---------- Tables ----------

-- Votes on the holiday plan: the most voted items come first
create table if not exists public.trip_item_votes (
  item_id     uuid not null references public.trip_items (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- ---------- Functions ----------

-- Who sees an event: whoever sees the group; a private event only members and guests
create or replace function public.can_see_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and public.can_see_group(e.group_id) and (e.visibility = 'public' or public.can_access_chat(e.group_id))
  );
$$;

-- Creates the dates of your groups' recurring events, from the first to the last day (all, or p_series).
-- With p_user = you: also adds you, as a regular, to the next occurrences you haven't answered.
-- Called by the app when it lists events: no scheduled job needed.
create or replace function public.extend_series(p_series uuid default null, p_user uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s public.event_series;
  today date;
  d date;
  last date;
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
    d := greatest(today, coalesce(s.starts_on, today), coalesce(s.generated_until + 1, today));
    -- with an end date: every date up to it; without (older series): four weeks ahead
    last := coalesce(s.ends_on, today + 27);
    while d <= last loop
      if extract(isodow from d)::smallint = any (s.weekdays) then
        starts := (d + s.start_time) at time zone s.timezone;
        if starts > now() then
          insert into public.events (group_id, created_by, title, date_time, location, lat, lon, tags, series_id, visibility)
          values (s.group_id, s.created_by, s.title, starts, s.location, s.lat, s.lon, s.tags, s.id, s.visibility)
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
    update public.event_series set generated_until = greatest(coalesce(generated_until, last), last) where id = s.id;

    if p_user = me then
      for new_id in select e.id from public.events e where e.series_id = s.id and e.date_time > now() loop
        perform public.apply_regulars(new_id, me);
      end loop;
    end if;
  end loop;
  return created;
end;
$$;

-- Creator or admin: move the last day of a recurring event (later: new dates; earlier: the dates
-- after it are deleted)
create or replace function public.set_series_end(p_series uuid, p_end date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.event_series;
begin
  select * into s from public.event_series where id = p_series;
  if s.id is null or not (s.created_by = (select auth.uid()) or public.is_group_admin(s.group_id)) then
    raise exception 'Solo chi l''ha creato o l''admin può cambiare la durata';
  end if;
  if p_end < s.starts_on or p_end > s.starts_on + 366 then
    raise exception 'La fine deve essere dopo l''inizio ed entro un anno';
  end if;
  update public.event_series set ends_on = p_end, generated_until = least(generated_until, p_end) where id = s.id;
  delete from public.events
  where series_id = s.id and date_time > now() and (date_time at time zone s.timezone)::date > p_end;
  perform public.extend_series(s.id);
end;
$$;

-- Tell the people going when an event changes date or place, is cancelled, or happens again
create or replace function public.handle_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  what text;
  details text;
  word text := case when new.kind = 'trip' then 'La vacanza' else 'L''evento' end;
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    what := case when new.kind = 'trip' then 'Vacanza annullata ❌' else 'Evento annullato ❌' end;
    details := '«' || new.title || '» del ' || to_char(new.date_time at time zone 'Europe/Rome', 'DD/MM') || ' non si fa più';
  elsif old.cancelled_at is not null and new.cancelled_at is null then
    what := word || ' si fa di nuovo 🎉';
    details := '«' || new.title || '» del ' || to_char(new.date_time at time zone 'Europe/Rome', 'DD/MM HH24:MI');
  elsif new.date_time is distinct from old.date_time or new.ends_at is distinct from old.ends_at
     or new.location is distinct from old.location then
    what := word || case when new.kind = 'trip' then ' è cambiata' else ' è cambiato' end;
    details := '«' || new.title || '»: ora ' || case when new.kind = 'trip'
        then to_char(new.date_time at time zone 'Europe/Rome', 'DD/MM') || '–' || to_char(coalesce(new.ends_at, new.date_time) at time zone 'Europe/Rome', 'DD/MM')
        else to_char(new.date_time at time zone 'Europe/Rome', 'DD/MM HH24:MI') end
      || coalesce(' · ' || nullif(new.location, ''), '');
  else
    return new;
  end if;
  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select a.user_id, 'event_update', what, details, new.group_id, new.id
  from public.event_attendees a
  where a.event_id = new.id and a.status = 'going' and a.user_id is distinct from (select auth.uid());
  return new;
end;
$$;

-- Plan items: who changed them last, and when. Only real changes count: when an account is deleted
-- the database clears created_by/updated_by, and that must not be signed by anyone.
create or replace function public.touch_trip_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := trim(new.title);
  if tg_op = 'INSERT' or (new.title, new.kind, new.day, new.done) is distinct from (old.title, old.kind, old.day, old.done) then
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$$;

-- Points earned so far (cancelled events don't count). Keep in sync with lib/points.ts.
--   person:   organized +10 (not the dates of a recurring event), attended +5, thanks +2, passenger in your car +5
--   business: organized +5, each person at your events +2, thanks +2
create or replace function public.earned_points(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select (case when u.account_type = 'business' then
      5 * (select count(*) from public.events e where e.created_by = uid and e.series_id is null and e.date_time <= now() and e.cancelled_at is null)
    + 2 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where e.created_by = uid and a.user_id <> uid and e.cancelled_at is null and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
    + 2 * (select count(*) from public.thanks t where t.to_user = uid)
  else
      10 * (select count(*) from public.events e where e.created_by = uid and e.series_id is null and e.date_time <= now() and e.cancelled_at is null)
    + 5 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where a.user_id = uid and e.cancelled_at is null and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
    + 2 * (select count(*) from public.thanks t where t.to_user = uid)
    + 5 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where a.ride_with = uid and a.ride_status = 'accepted' and e.cancelled_at is null and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
  end)::integer
  from public.users u where u.id = uid;
$$;

-- "Per te": counts only, never names (private and cancelled events left out for who can't see them)
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
      and e.date_time > now() and e.cancelled_at is null and public.can_see_event(e.id)
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

-- Weekly newsletter ("La tua settimana"): private and cancelled events left out
create or replace function public.newsletter_digest()
returns json language plpgsql security definer set search_path = '' as $$
declare
  me public.users;
  s public.user_settings;
  picks json;
begin
  select * into me from public.users where id = (select auth.uid());
  select * into s from public.user_settings where user_id = me.id;
  if me.id is null or not coalesce(s.newsletter, true) or s.newsletter_sent_at > now() - interval '7 days' then
    return null;
  end if;
  select json_agg(x) into picks from (
    select * from (
      select distinct on (coalesce(e.series_id, e.id)) e.id, e.title, e.date_time
      from public.events e
      where e.date_time between now() and now() + interval '7 days'
        and e.cancelled_at is null and public.can_see_event(e.id)
        and not exists (select 1 from public.event_attendees a where a.event_id = e.id and a.user_id = me.id)
        and (e.tags && me.interests or (
          s.area_lat is not null and e.lat is not null
          and public.distance_km(s.area_lat, s.area_lon, e.lat, e.lon) <= s.search_radius_km
        ))
      order by coalesce(e.series_id, e.id), e.date_time
    ) y
    order by y.date_time
    limit 5
  ) x;
  insert into public.user_settings (user_id, newsletter_sent_at) values (me.id, now())
  on conflict (user_id) do update set newsletter_sent_at = now();
  if picks is null then
    return null;
  end if;
  insert into public.notifications (user_id, type, title, body)
  values (me.id, 'digest', '📰 La tua settimana su Huddle',
    json_array_length(picks) || case when json_array_length(picks) = 1 then ' evento per te: ' else ' eventi per te: ' end
      || (select string_agg(p ->> 'title', ', ') from json_array_elements(picks) p));
  return picks;
end;
$$;

-- The group's history (private events only for members and guests; cancelled ones left out)
create or replace function public.group_history(gid uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'created_at', g.created_at,
    'events', coalesce((
      select json_agg(x order by x.date_time) from (
        select e.id, e.title, e.kind, e.date_time, e.ends_at, e.location, e.series_id,
          (select count(*) from public.event_attendees a where a.event_id = e.id and (a.status = 'going' or a.checked_in))::int as going,
          coalesce((select json_agg(p.url order by p.created_at) from public.event_photos p where p.event_id = e.id), '[]'::json) as photos
        from public.events e
        where e.group_id = g.id and e.date_time <= now() and e.cancelled_at is null
          and (e.visibility = 'public' or public.can_access_chat(g.id))
      ) x
    ), '[]'::json),
    'members', coalesce((
      select json_agg(json_build_object('user_id', m.user_id, 'full_name', u.full_name, 'joined_at', m.joined_at) order by m.joined_at)
      from public.group_members m join public.users u on u.id = m.user_id
      where m.group_id = g.id and m.user_id <> g.admin_id
    ), '[]'::json)
  )
  from public.groups g
  where g.id = gid and public.can_see_group(gid);
$$;

-- Delete your account: your groups pass to the member who joined first (a group left empty, or a
-- venue's page, is deleted), then the profile and everything personal go (database cascades).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  g record;
  heir uuid;
begin
  if me is null then
    raise exception 'Accedi per eliminare l''account';
  end if;
  for g in select id, is_business from public.groups where admin_id = me loop
    select m.user_id into heir from public.group_members m
    where m.group_id = g.id and m.user_id <> me order by m.joined_at limit 1;
    if heir is null or g.is_business then
      delete from public.groups where id = g.id;
    else
      update public.groups set admin_id = heir where id = g.id;
      update public.group_members set role = 'admin' where group_id = g.id and user_id = heir;
    end if;
  end loop;
  delete from auth.users where id = me;
end;
$$;

-- ---------- Triggers ----------

drop trigger if exists after_event_change on public.events;
create trigger after_event_change
  after update of date_time, ends_at, location, cancelled_at on public.events
  for each row execute function public.handle_event_change();

-- ---------- Row Level Security ----------

alter table public.trip_item_votes enable row level security;

-- events: private ones only for members and guests
drop policy if exists "events: read" on public.events;
create policy "events: read" on public.events
  for select to authenticated using (
    public.can_see_group(group_id) and (visibility = 'public' or public.can_access_chat(group_id))
  );

-- event_photos: seen like the event
drop policy if exists "event_photos: read" on public.event_photos;
create policy "event_photos: read" on public.event_photos
  for select to authenticated using (public.can_see_event(event_id));

-- No answers to a cancelled event
drop policy if exists "event_attendees: answer self" on public.event_attendees;
create policy "event_attendees: answer self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.cancelled_at is null and public.can_join_event(e.group_id)
    )
    and (not checked_in or public.is_checkin_open(event_id))
  );

-- trip_item_votes: members and guests see the votes and vote for themselves
drop policy if exists "trip_item_votes: read with access" on public.trip_item_votes;
create policy "trip_item_votes: read with access" on public.trip_item_votes
  for select to authenticated using (
    exists (
      select 1 from public.trip_items t join public.events e on e.id = t.event_id
      where t.id = item_id and public.can_access_chat(e.group_id)
    )
  );
drop policy if exists "trip_item_votes: vote" on public.trip_item_votes;
create policy "trip_item_votes: vote" on public.trip_item_votes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.trip_items t join public.events e on e.id = t.event_id
      where t.id = item_id and public.can_access_chat(e.group_id)
    )
  );
drop policy if exists "trip_item_votes: take back" on public.trip_item_votes;
create policy "trip_item_votes: take back" on public.trip_item_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Who can call the functions ----------

revoke execute on function public.set_series_end(uuid, date), public.delete_my_account(), public.can_see_event(uuid) from public, anon;
grant execute on function public.set_series_end(uuid, date), public.delete_my_account(), public.can_see_event(uuid) to authenticated;
