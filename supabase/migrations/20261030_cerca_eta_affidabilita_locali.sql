-- =============================================================================
-- Huddle — update of 30/10/2026: search with distance/age/interests, age range of groups,
-- reliability from points, venue/business accounts (with event promotion), weekly newsletter
-- For a Supabase project that already ran 20261029_vacanze_foto_spese_storia.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- New notifications: a venue's event promoted to your area, the weekly newsletter
alter type public.notification_type add value if not exists 'promo';
alter type public.notification_type add value if not exists 'digest';

do $$ begin
  create type public.account_type as enum ('person', 'business');  -- "Persona" / "Locale o azienda"
exception when duplicate_object then null;
end $$;

-- ---------- Columns ----------

alter table public.users add column if not exists account_type public.account_type not null default 'person';

-- Groups: where they meet (coordinates from the "Zona" search, for the distance filter and the
-- venues' promotions), the age range they're for, what they're into, venue pages
alter table public.groups
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists age_min smallint,
  add column if not exists age_max smallint,
  add column if not exists tags text[] not null default '{}',
  add column if not exists is_business boolean not null default false;  -- a venue's page: anyone can join its events
alter table public.groups drop constraint if exists groups_coords_check;
alter table public.groups add constraint groups_coords_check check (lat between -90 and 90 and lon between -180 and 180);
alter table public.groups drop constraint if exists groups_age_check;
alter table public.groups add constraint groups_age_check
  check (age_min between 14 and 99 and age_max between 14 and 99 and age_min <= age_max);
alter table public.groups drop constraint if exists groups_tags_check;
alter table public.groups add constraint groups_tags_check check (cardinality(tags) <= 5);

-- ---------- Tables ----------

-- Private settings: only you read them (your age and your area are not on the public profile)
create table if not exists public.user_settings (
  user_id             uuid primary key references public.users (id) on delete cascade,
  birth_year          smallint check (birth_year between 1900 and 2015),
  area                text check (char_length(area) <= 200),  -- "your area", for distances
  area_lat            double precision check (area_lat between -90 and 90),
  area_lon            double precision check (area_lon between -180 and 180),
  search_radius_km    smallint not null default 25 check (search_radius_km between 1 and 200),
  newsletter          boolean not null default true,   -- weekly "La tua settimana" in Attività
  newsletter_sent_at  timestamptz,
  accept_promos       boolean not null default true    -- events of venues near your groups
);
insert into public.user_settings (user_id) select id from public.users on conflict do nothing;

-- Points spent (venues: promoting an event). Balance = earned_points - spent.
create table if not exists public.point_spends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  points      integer not null check (points > 0),
  reason      text not null check (reason in ('promo')),
  event_id    uuid references public.events (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists point_spends_user_idx on public.point_spends (user_id);

-- ---------- Functions ----------

-- Create the public profile (and the private settings) when someone signs up. A venue/business
-- also gets its page: a public group where it publishes its events.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1), 'Utente');
  kind public.account_type := coalesce((meta ->> 'account_type')::public.account_type, 'person');
begin
  insert into public.users (id, full_name, is_relocated, relocated_at, interests, role, intent, account_type)
  values (
    new.id,
    name,
    coalesce((meta ->> 'is_relocated')::boolean, false),
    nullif(meta ->> 'relocated_at', '')::date,
    coalesce(array(select jsonb_array_elements_text(
      case when jsonb_typeof(meta -> 'interests') = 'array' then meta -> 'interests' else '[]'::jsonb end)), '{}'),
    coalesce((meta ->> 'role')::public.user_role, 'solo'),
    coalesce((meta ->> 'intent')::public.user_intent, 'friends'),
    kind
  );
  insert into public.user_settings (user_id, birth_year)
  values (new.id, case when kind = 'person' then nullif(meta ->> 'birth_year', '')::smallint end);
  if kind = 'business' then
    insert into public.groups (name, description, admin_id, is_business, icon, color)
    values (name, 'Gli eventi di ' || name, new.id, true, '🎉', 'amber');
  end if;
  return new;
end;
$$;

-- Account type and venue pages can't be changed afterwards (they decide points and who can join)
create or replace function public.protect_account_type()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.account_type := old.account_type;
  return new;
end;
$$;

create or replace function public.protect_business_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.is_business := old.is_business;
  else
    new.is_business := new.is_business
      and coalesce((select account_type = 'business' from public.users where id = new.admin_id), false);
  end if;
  return new;
end;
$$;

-- Who can answer an event ("Ci sono"): members and guests, and anyone for a venue's public page
create or replace function public.can_join_event(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_chat(gid)
    or exists (select 1 from public.groups g where g.id = gid and g.is_business and g.visibility = 'public');
$$;

-- Kilometers between two points (haversine)
create or replace function public.distance_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 12742 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- Points earned so far. Keep in sync with lib/points.ts.
--   person:   organized +10 (not the dates of a recurring event), attended +5, thanks +2, passenger in your car +5
--   business: organized +5, each person at your events +2, thanks +2
create or replace function public.earned_points(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select (case when u.account_type = 'business' then
      5 * (select count(*) from public.events e where e.created_by = uid and e.series_id is null and e.date_time <= now())
    + 2 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where e.created_by = uid and a.user_id <> uid and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
    + 2 * (select count(*) from public.thanks t where t.to_user = uid)
  else
      10 * (select count(*) from public.events e where e.created_by = uid and e.series_id is null and e.date_time <= now())
    + 5 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where a.user_id = uid and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
    + 2 * (select count(*) from public.thanks t where t.to_user = uid)
    + 5 * (select count(*) from public.event_attendees a join public.events e on e.id = a.event_id
           where a.ride_with = uid and a.ride_status = 'accepted' and (a.checked_in or (a.status = 'going' and e.date_time <= now())))
  end)::integer
  from public.users u where u.id = uid;
$$;

-- Your points: earned, spent and what's left to spend
create or replace function public.my_points()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'earned', public.earned_points((select auth.uid())),
    'spent', coalesce((select sum(points) from public.point_spends where user_id = (select auth.uid())), 0)
  );
$$;

-- Reliability ("affidabilità") comes from the points: of people, and of groups (the members'
-- average; a venue's page: the venue's own points). Up to 300 people and 300 groups per call.
create or replace function public.reliability(p_users uuid[], p_groups uuid[])
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'users', coalesce((
      select json_object_agg(x, public.earned_points(x)) from unnest(p_users[1:300]) as x
    ), '{}'::json),
    'groups', coalesce((
      select json_object_agg(g.id, case when g.is_business then public.earned_points(g.admin_id) else (
          select coalesce(round(avg(public.earned_points(m.user_id))), 0) from public.group_members m where m.group_id = g.id
        ) end)
      from public.groups g where g.id = any (p_groups[1:300]) and public.can_see_group(g.id)
    ), '{}'::json)
  );
$$;

-- A venue promotes one of its events to the groups in the area (within p_radius_km of the event):
-- their members get a notification (unless they turned promotions off). Costs 20 points, once per event.
create or replace function public.promote_event(p_event uuid, p_radius_km integer default 10)
returns json language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  cost constant integer := 20;
  venue public.users;
  ev public.events;
  balance integer;
  groups_reached integer;
  people_reached integer;
begin
  select * into venue from public.users where id = me;
  if venue.account_type is distinct from 'business' then
    raise exception 'Solo i locali e le aziende possono promuovere un evento';
  end if;
  select * into ev from public.events where id = p_event;
  if ev.id is null or ev.created_by is distinct from me then
    raise exception 'Puoi promuovere solo i tuoi eventi';
  end if;
  if ev.lat is null then
    raise exception 'Scegli il luogo dai suggerimenti: serve per sapere quali gruppi sono in zona';
  end if;
  if coalesce(ev.ends_at, ev.date_time) < now() then
    raise exception 'L''evento è già passato';
  end if;
  if p_radius_km not between 1 and 50 then
    raise exception 'Scegli una distanza tra 1 e 50 km';
  end if;
  if exists (select 1 from public.point_spends where event_id = p_event and reason = 'promo') then
    raise exception 'Hai già promosso questo evento';
  end if;
  balance := public.earned_points(me) - coalesce((select sum(points) from public.point_spends where user_id = me), 0);
  if balance < cost then
    raise exception 'Servono % punti, ne hai %: li guadagni con le persone che vengono ai tuoi eventi', cost, balance;
  end if;

  insert into public.point_spends (user_id, points, reason, event_id) values (me, cost, 'promo', p_event);
  select count(*) into groups_reached from public.groups g
  where g.lat is not null and not g.is_business and public.distance_km(g.lat, g.lon, ev.lat, ev.lon) <= p_radius_km;
  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select distinct on (m.user_id) m.user_id, 'promo', venue.full_name || ' ti invita 📣',
    ev.title || coalesce(' · ' || nullif(ev.location, ''), '') || ' · ' || to_char(ev.date_time at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
    ev.group_id, ev.id
  from public.groups g
  join public.group_members m on m.group_id = g.id
  left join public.user_settings s on s.user_id = m.user_id
  where g.lat is not null and not g.is_business and public.distance_km(g.lat, g.lon, ev.lat, ev.lon) <= p_radius_km
    and m.user_id <> me and coalesce(s.accept_promos, true);
  get diagnostics people_reached = row_count;
  return json_build_object('groups', groups_reached, 'people', people_reached, 'spent', cost);
end;
$$;

-- Weekly newsletter ("La tua settimana"): at most once every 7 days, when you open "Per te", a
-- notification with up to 5 events of the next week near your area or matching your interests.
-- Returns the picked events (or null). No scheduled job needed.
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
        and public.can_see_group(e.group_id)
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

-- ---------- Triggers ----------

drop trigger if exists before_user_update on public.users;
create trigger before_user_update
  before update of account_type on public.users
  for each row execute function public.protect_account_type();

drop trigger if exists before_group_business on public.groups;
create trigger before_group_business
  before insert or update on public.groups
  for each row execute function public.protect_business_group();

-- ---------- Row Level Security ----------

alter table public.user_settings enable row level security;
alter table public.point_spends  enable row level security;

drop policy if exists "user_settings: own" on public.user_settings;
create policy "user_settings: own" on public.user_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "point_spends: read own" on public.point_spends;
create policy "point_spends: read own" on public.point_spends
  for select to authenticated using (user_id = (select auth.uid()));

-- Venue events: anyone can answer and see who's coming (the chat stays for members)
drop policy if exists "event_attendees: read" on public.event_attendees;
create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_join_event(e.group_id))
  );
drop policy if exists "event_attendees: answer self" on public.event_attendees;
create policy "event_attendees: answer self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and public.can_join_event(e.group_id))
    and (not checked_in or public.is_checkin_open(event_id))
  );
drop policy if exists "event_photos: add own" on public.event_photos;
create policy "event_photos: add own" on public.event_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and public.can_join_event(e.group_id) and e.date_time - interval '1 hour' <= now()
    )
  );
drop policy if exists "event-photos: upload own" on storage.objects;
create policy "event-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-photos' and split_part(name, '/', 2) = (select auth.uid())::text and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 1) and public.can_join_event(e.group_id)));

-- ---------- Who can call the functions ----------

revoke execute on function
  public.my_points(), public.reliability(uuid[], uuid[]), public.promote_event(uuid, integer),
  public.newsletter_digest(), public.earned_points(uuid)
  from public, anon;
grant execute on function
  public.my_points(), public.reliability(uuid[], uuid[]), public.promote_event(uuid, integer),
  public.newsletter_digest(), public.earned_points(uuid)
  to authenticated;
