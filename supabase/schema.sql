-- =============================================================================
-- Huddle — Supabase schema (PostgreSQL)
-- Run once on a fresh project: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Mirrors lib/types.ts. Row Level Security is enabled on every table.
-- =============================================================================

-- ---------- Enums ----------

create type public.user_role   as enum ('solo', 'group');
create type public.user_intent as enum ('friends', 'group', 'friends_and_dating');
create type public.group_type  as enum ('closed', 'open_to_new');
create type public.group_visibility as enum ('public', 'private');  -- private: only members and invite links
create type public.member_role as enum ('admin', 'member');
create type public.join_status as enum ('pending', 'guest', 'accepted', 'rejected');
create type public.rsvp_status as enum ('going', 'not_going'); -- "Ci sono" / "Non ci sono"
create type public.transport as enum ('car', 'need_ride', 'own');  -- "In auto" / "Mi serve un passaggio" / "Per conto mio"
create type public.notification_type as enum
  ('join_request', 'request_accepted', 'request_guest', 'request_rejected', 'new_event', 'rank_up', 'thanks', 'ride');

-- ---------- Tables ----------

-- Public profile, 1:1 with auth.users (email/password live in auth.users)
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 1 and 100),
  bio           text not null default '',
  is_relocated  boolean not null default false,
  relocated_at  date,  -- roughly when they moved to the city ("In città da 3 mesi")
  interests     text[] not null default '{}',
  -- Avatar: photo (Storage bucket "avatars") or GitHub-style pixel avatar generated from the seed
  avatar_url    text,
  avatar_seed   text default substr(md5(random()::text), 1, 10),
  role          public.user_role not null default 'solo',
  intent        public.user_intent not null default 'friends',
  created_at    timestamptz not null default now()
);

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  description  text not null default '',
  admin_id     uuid not null references public.users (id) on delete cascade,
  location     text not null default '',
  type         public.group_type not null default 'open_to_new',
  -- public: listed in "Gruppi" for everyone; private: only members (and whoever has the invite link) see it
  visibility   public.group_visibility not null default 'public',
  -- Secret part of the invite link (/invite/<code>); the admin can replace it if it leaks
  invite_code  text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
               check (invite_code ~ '^[a-z0-9]{8,32}$'),
  -- Group "photo": an emoji on a colored tile, only from the lists in lib/groupIcons.ts (keep in sync)
  icon         text check (icon is null or icon = any (array[
      '⚽', '🏀', '🏐', '🎾', '🏓', '🏸', '⛳', '🥊', '⛷️', '🏂', '🚴', '🏃',
      '🧗', '🏊', '🧘', '🏋️', '🛹', '🛶', '⛰️', '🥾', '🏕️', '🌊', '🌿', '🌻',
      '🐶', '🐱', '🎣', '🚲', '📚', '✍️', '🎭', '🎨', '🎬', '📷', '🏛️', '🗣️',
      '🧠', '🌍', '🎧', '🎸', '🎹', '🎤', '🥁', '🎷', '🎻', '🎶', '💻', '📱',
      '🤖', '🎮', '🎲', '♟️', '🧩', '🚀', '🍕', '🍝', '🍣', '🍔', '☕', '🍷',
      '🍻', '🥂', '🍰', '🍳', '✈️', '🚗', '🚆', '🏖️', '🗺️', '🏙️', '👥', '💬',
      '❤️', '🎉', '⭐', '🌈', '🔥', '🍀'
  ])),
  color        text check (color is null or color in ('orange', 'rose', 'violet', 'sky', 'teal', 'green', 'amber', 'slate')),
  created_at   timestamptz not null default now()
);

create table public.group_members (
  user_id    uuid not null references public.users (id) on delete cascade,
  group_id   uuid not null references public.groups (id) on delete cascade,
  role       public.member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (user_id, group_id)
);
create index group_members_group_id_idx on public.group_members (group_id);

-- Any member can organize an event (created_by = the organizer)
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  created_by  uuid references public.users (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 150),
  date_time   timestamptz not null,
  location    text not null default '',
  -- Coordinates of the place (from the address search): used by "Trova parcheggio" in SmartPark
  lat         double precision check (lat between -90 and 90),
  lon         double precision check (lon between -180 and 180),
  -- Optional poster ("locandina") in the Storage bucket "event-posters": a PDF or an image
  poster_url  text,
  poster_mime text check (poster_mime is null or poster_mime = 'application/pdf' or poster_mime like 'image/%'),
  created_at  timestamptz not null default now()
);
create index events_group_id_date_time_idx on public.events (group_id, date_time);
create index events_date_time_idx on public.events (date_time);

-- Private links of a group: external chat (WhatsApp, Telegram…) and the SmartPark group code
-- (shared parking among the friends). Kept out of "groups" because groups are readable by every
-- signed-in user, while these must stay with members and guests.
create table public.group_links (
  group_id      uuid primary key references public.groups (id) on delete cascade,
  chat_url      text check (chat_url like 'https://%'),
  parking_code  text check (parking_code ~ '^[A-Z0-9]{4,16}$'),
  updated_at    timestamptz not null default now()
);

-- Who's coming ("Ci sono" / "Non ci sono") and who checked in ("Sono qui").
-- An event counts as attended if you checked in, or said "Ci sono" and it has started:
-- that drives ranks (lib/ranks.ts) and points (lib/points.ts).
create table public.event_attendees (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  status      public.rsvp_status not null default 'going',
  checked_in  boolean not null default false,
  -- Getting there: drivers offer seats, passengers pick a driver (ride_with)
  transport   public.transport,
  seats       smallint not null default 0 check (seats between 0 and 8),
  ride_with   uuid references public.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id),
  check (ride_with is distinct from user_id)
);
create index event_attendees_user_id_idx on public.event_attendees (user_id);
create index event_attendees_ride_with_idx on public.event_attendees (event_id, ride_with);

-- Where a driver left the car (from SmartPark, only if the driver chooses to share it):
-- visible only to the driver and their passengers, and only until 12 hours after the event
create table public.car_spots (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  shared_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- "Grazie" to the organizer or to someone who came to an event (+ points for them)
create table public.thanks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  from_user   uuid not null references public.users (id) on delete cascade,
  to_user     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (event_id, from_user, to_user),
  check (from_user <> to_user)
);
create index thanks_to_user_idx on public.thanks (to_user);
create index thanks_event_id_idx on public.thanks (event_id);

create table public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  status      public.join_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, group_id)
);
create index join_requests_group_id_idx on public.join_requests (group_id);

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index chat_messages_group_id_created_at_idx on public.chat_messages (group_id, created_at);

-- Activity feed ("Attività"). Rows are created only by the triggers below.
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text not null default '',
  group_id    uuid references public.groups (id) on delete cascade,
  event_id    uuid references public.events (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);

-- Unused for now. Each pair is stored once, with user_a < user_b.
create table public.friendships (
  user_a         uuid not null references public.users (id) on delete cascade,
  user_b         uuid not null references public.users (id) on delete cascade,
  level          integer not null default 0,
  shared_points  integer not null default 0,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- ---------- Helper functions (used by RLS policies) ----------
-- SECURITY DEFINER lets them read group_members/join_requests without
-- triggering those tables' own policies (avoids infinite recursion).

create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups
    where id = gid and admin_id = (select auth.uid())
  );
$$;

-- Who can see a group (and its members and events): everyone for public groups; for private ones
-- the admin, the members and whoever asked to join (with the invite link)
create or replace function public.can_see_group(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.groups g
      where g.id = gid and (g.visibility = 'public' or g.admin_id = (select auth.uid()))
    )
    or public.is_group_member(gid)
    or exists (
      select 1 from public.join_requests r
      where r.group_id = gid and r.user_id = (select auth.uid()) and r.status <> 'rejected'
    );
$$;

-- Members, guests and accepted requesters may use the lobby/chat and the events' details
create or replace function public.can_access_chat(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_group_member(gid) or exists (
    select 1 from public.join_requests
    where group_id = gid
      and user_id = (select auth.uid())
      and status in ('guest', 'accepted')
  );
$$;

-- The event's organizer or the group's admin
create or replace function public.can_manage_event(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (e.created_by = (select auth.uid()) or public.is_group_admin(e.group_id))
  );
$$;

-- Rank name for a number of attended events in a group. Keep in sync with lib/ranks.ts.
create or replace function public.rank_name(attended integer)
returns text language sql immutable set search_path = '' as $$
  select case
    when attended >= 15 then 'Leggenda vivente 👑'
    when attended >= 10 then 'Colonna portante 🏛️'
    when attended >= 6  then 'Anima della festa 🎉'
    when attended >= 3  then 'Prezzemolo 🌿'
    when attended >= 1  then 'Faccia nota 👋'
    else 'Turista per caso 🧳'
  end;
$$;

-- Check-in window: from 1 hour before the start to 6 hours after. Keep in sync with lib/eventTiming.ts.
create or replace function public.is_checkin_open(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events
    where id = eid and now() between date_time - interval '1 hour' and date_time + interval '6 hours'
  );
$$;

-- ---------- Triggers ----------

-- Create the public profile when someone signs up.
-- The app passes full_name/role/intent/is_relocated/relocated_at/interests in signUp's options.data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.users (id, full_name, is_relocated, relocated_at, interests, role, intent)
  values (
    new.id,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1), 'Utente'),
    coalesce((meta ->> 'is_relocated')::boolean, false),
    nullif(meta ->> 'relocated_at', '')::date,
    coalesce(array(select jsonb_array_elements_text(
      case when jsonb_typeof(meta -> 'interests') = 'array' then meta -> 'interests' else '[]'::jsonb end)), '{}'),
    coalesce((meta ->> 'role')::public.user_role, 'solo'),
    coalesce((meta ->> 'intent')::public.user_intent, 'friends')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a group automatically becomes its admin member
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (user_id, group_id, role)
  values (new.admin_id, new.id, 'admin')
  on conflict (user_id, group_id) do update set role = 'admin';
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Tell the admin about a new join request
create or replace function public.handle_new_join_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, group_id)
  select g.admin_id, 'join_request', 'Nuova richiesta', u.full_name || ' vuole entrare in ' || g.name, g.id
  from public.groups g, public.users u
  where g.id = new.group_id and u.id = new.user_id;
  return new;
end;
$$;

create trigger on_join_request_created
  after insert on public.join_requests
  for each row execute function public.handle_new_join_request();

-- Keep updated_at fresh, add the member when a request is accepted, and tell the requester
create or replace function public.handle_join_request_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  group_name text;
begin
  new.updated_at := now();
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.group_members (user_id, group_id, role)
    values (new.user_id, new.group_id, 'member')
    on conflict (user_id, group_id) do nothing;
  end if;

  if new.status is distinct from old.status and new.status <> 'pending' then
    select name into group_name from public.groups where id = new.group_id;
    insert into public.notifications (user_id, type, title, body, group_id)
    values (
      new.user_id,
      case new.status
        when 'accepted' then 'request_accepted'
        when 'guest' then 'request_guest'
        else 'request_rejected'
      end::public.notification_type,
      case new.status
        when 'accepted' then 'Richiesta accettata 🎉'
        when 'guest' then 'Sei ospite'
        else 'Richiesta non accettata'
      end,
      case new.status
        when 'accepted' then 'Ora fai parte di ' || group_name || '. Presentati in chat!'
        when 'guest' then 'Puoi entrare nella lobby di ' || group_name || ' e andare a un evento.'
        else group_name || ' al momento non può accoglierti.'
      end,
      new.group_id
    );
  end if;
  return new;
end;
$$;

create trigger on_join_request_updated
  before update on public.join_requests
  for each row execute function public.handle_join_request_update();

-- New event: the organizer is automatically "Ci sono", the other members get a notification
create or replace function public.handle_new_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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

create trigger on_event_created
  after insert on public.events
  for each row execute function public.handle_new_event();

-- Keep attendee rows consistent: a check-in can't be undone and always means "Ci sono"
create or replace function public.normalize_attendee()
returns trigger language plpgsql set search_path = '' as $$
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A passenger can only pick someone who drives to this event and still has a free seat
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
  where event_id = new.event_id and ride_with = new.ride_with and user_id <> new.user_id;
  if taken >= driver_seats then
    raise exception 'Non ci sono più posti in quest''auto';
  end if;
  return new;
end;
$$;

create trigger before_ride_change
  before insert or update of ride_with on public.event_attendees
  for each row execute function public.check_ride();

-- When a driver stops driving (or says "Non ci sono"), their passengers are free again;
-- when someone gets in a car, the driver gets a notification
create or replace function public.handle_ride_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.transport = 'car' and new.transport is distinct from 'car' then
    update public.event_attendees set ride_with = null
    where event_id = new.event_id and ride_with = new.user_id;
    delete from public.car_spots where event_id = new.event_id and user_id = new.user_id;
  end if;
  if new.ride_with is not null and (tg_op = 'INSERT' or new.ride_with is distinct from old.ride_with) then
    insert into public.notifications (user_id, type, title, body, group_id, event_id)
    select new.ride_with, 'ride', u.full_name || ' viene in auto con te 🚗', 'Per «' || e.title || '»', e.group_id, e.id
    from public.users u, public.events e
    where u.id = new.user_id and e.id = new.event_id;
  end if;
  return new;
end;
$$;

create trigger after_ride_change
  after insert or update on public.event_attendees
  for each row execute function public.handle_ride_change();

create trigger before_attendee_change
  before insert or update on public.event_attendees
  for each row execute function public.normalize_attendee();

-- On check-in, congratulate the user when they reach a new rank in that group
create or replace function public.handle_check_in()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
  total integer;
begin
  if not new.checked_in or (tg_op = 'UPDATE' and old.checked_in) then
    return new;
  end if;
  select group_id into gid from public.events where id = new.event_id;
  -- Attended events in this group, counting this one
  select count(*) into total
  from public.event_attendees a join public.events e on e.id = a.event_id
  where a.user_id = new.user_id and e.group_id = gid
    and (a.checked_in or (a.status = 'going' and e.date_time <= now()) or a.event_id = new.event_id);
  if public.rank_name(total) <> public.rank_name(total - 1) then
    insert into public.notifications (user_id, type, title, body, group_id)
    select new.user_id, 'rank_up', 'Nuovo grado: ' || public.rank_name(total), g.name, g.id
    from public.groups g where g.id = gid;
  end if;
  return new;
end;
$$;

create trigger on_check_in
  after insert or update of checked_in on public.event_attendees
  for each row execute function public.handle_check_in();

-- Tell people when someone thanks them
create or replace function public.handle_new_thanks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select new.to_user, 'thanks', u.full_name || ' ti ha ringraziato 🙏', 'Per «' || e.title || '»', e.group_id, e.id
  from public.users u, public.events e
  where u.id = new.from_user and e.id = new.event_id;
  return new;
end;
$$;

create trigger on_thanks_created
  after insert on public.thanks
  for each row execute function public.handle_new_thanks();

-- ---------- Invite links (/invite/<code>) ----------
-- Private groups are invisible to non-members, so the invite link goes through these functions.

-- Preview of the group behind an invite link (null if the link is wrong)
create or replace function public.group_by_invite(p_code text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', g.id, 'name', g.name, 'description', g.description, 'icon', g.icon, 'color', g.color,
    'type', g.type, 'visibility', g.visibility,
    'member_count', (select count(*) from public.group_members m where m.group_id = g.id),
    'my_status', case
      when public.is_group_member(g.id) then 'member'
      else (select r.status::text from public.join_requests r where r.group_id = g.id and r.user_id = (select auth.uid()))
    end
  )
  from public.groups g
  where g.invite_code = p_code;
$$;

-- "Chiedi di unirti" from an invite link: a pending request (the admin still approves). Returns the status.
create or replace function public.request_join_by_invite(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
  existing public.join_requests;
begin
  if (select auth.uid()) is null then raise exception 'Accedi per entrare nel gruppo'; end if;
  select * into g from public.groups where invite_code = p_code;
  if not found then raise exception 'Link d''invito non valido o scaduto'; end if;
  if public.is_group_member(g.id) then return 'member'; end if;
  if g.type = 'closed' then raise exception 'Questo gruppo al momento non accetta nuovi membri'; end if;
  select * into existing from public.join_requests where group_id = g.id and user_id = (select auth.uid());
  if found then
    if existing.status <> 'rejected' then return existing.status::text; end if;
    delete from public.join_requests where id = existing.id;   -- rejected before: may ask again
  end if;
  insert into public.join_requests (user_id, group_id) values ((select auth.uid()), g.id);
  return 'pending';
end;
$$;

revoke execute on function public.group_by_invite(text), public.request_join_by_invite(text) from public, anon;
grant execute on function public.group_by_invite(text), public.request_join_by_invite(text) to authenticated;

-- ---------- Row Level Security ----------

alter table public.users           enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;
alter table public.thanks          enable row level security;
alter table public.join_requests   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.friendships     enable row level security;
alter table public.notifications   enable row level security;
alter table public.group_links     enable row level security;
alter table public.car_spots       enable row level security;

-- users: any signed-in user can read profiles; you can only create/edit your own
create policy "users: read" on public.users
  for select to authenticated using (true);
create policy "users: insert own" on public.users
  for insert to authenticated with check (id = (select auth.uid()));
create policy "users: update own" on public.users
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups: readable by signed-in users; only the admin can create/edit/delete
create policy "groups: read" on public.groups
  -- admin_id is read from the row itself: right after "create group" the helper function can't see it yet
  for select to authenticated using (visibility = 'public' or admin_id = (select auth.uid()) or public.can_see_group(id));
create policy "groups: create as admin" on public.groups
  for insert to authenticated with check (admin_id = (select auth.uid()));
create policy "groups: admin update" on public.groups
  for update to authenticated using (admin_id = (select auth.uid())) with check (admin_id = (select auth.uid()));
create policy "groups: admin delete" on public.groups
  for delete to authenticated using (admin_id = (select auth.uid()));

-- group_members: member lists are visible (group detail screen);
-- admins manage members, anyone can leave a group.
-- Joining normally happens through the accepted-request trigger.
create policy "group_members: read" on public.group_members
  for select to authenticated using (public.can_see_group(group_id));
create policy "group_members: admin add" on public.group_members
  for insert to authenticated with check (public.is_group_admin(group_id));
create policy "group_members: admin update" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "group_members: leave or admin remove" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

-- events: readable by signed-in users; any member organizes (as themselves);
-- the organizer or the admin edits/deletes
create policy "events: read" on public.events
  for select to authenticated using (public.can_see_group(group_id));
create policy "events: member organizes" on public.events
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_group_member(group_id));
create policy "events: organizer or admin update" on public.events
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id))
  with check (public.is_group_member(group_id) or public.is_group_admin(group_id));
create policy "events: organizer or admin delete" on public.events
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_group_admin(group_id));

-- event_attendees: visible to people with access to the group; you answer for yourself.
-- checked_in = true is accepted only inside the check-in window (the trigger keeps it from being undone).
create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
create policy "event_attendees: answer self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
    and (not checked_in or public.is_checkin_open(event_id))
  );
create policy "event_attendees: change own answer" on public.event_attendees
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (not checked_in or public.is_checkin_open(event_id)));
create policy "event_attendees: remove own answer" on public.event_attendees
  for delete to authenticated using (user_id = (select auth.uid()) and not checked_in);

-- car_spots: the driver shares where the car is; only the driver and their passengers see it,
-- and only until 12 hours after the event
create policy "car_spots: driver and passengers" on public.car_spots
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and now() < e.date_time + interval '12 hours')
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.event_attendees a
        where a.event_id = car_spots.event_id and a.user_id = (select auth.uid()) and a.ride_with = car_spots.user_id
      )
    )
  );
create policy "car_spots: share own" on public.car_spots
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.event_attendees a
      where a.event_id = car_spots.event_id and a.user_id = (select auth.uid()) and a.transport = 'car'
    )
  );
create policy "car_spots: update own" on public.car_spots
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "car_spots: stop sharing" on public.car_spots
  for delete to authenticated using (user_id = (select auth.uid()));

-- thanks: visible to the group; you thank as yourself, only the organizer or someone who said "Ci sono"
create policy "thanks: read" on public.thanks
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
create policy "thanks: send" on public.thanks
  for insert to authenticated with check (
    from_user = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and public.can_access_chat(e.group_id)
        and (
          e.created_by = to_user
          or exists (
            select 1 from public.event_attendees a
            where a.event_id = e.id and a.user_id = to_user and a.status = 'going'
          )
        )
    )
  );
create policy "thanks: take back" on public.thanks
  for delete to authenticated using (from_user = (select auth.uid()));

-- join_requests: you see your own, the group admin sees the group's.
-- You can only create a 'pending' request for an open group; only the admin changes status.
create policy "join_requests: read own or admin" on public.join_requests
  for select to authenticated using (user_id = (select auth.uid()) or public.is_group_admin(group_id));
create policy "join_requests: create own pending" on public.join_requests
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.groups g where g.id = group_id and g.type = 'open_to_new')
  );
create policy "join_requests: admin update" on public.join_requests
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "join_requests: withdraw own" on public.join_requests
  for delete to authenticated using (user_id = (select auth.uid()));

-- chat_messages: only members/guests/accepted can read and post (as themselves)
create policy "chat_messages: read with access" on public.chat_messages
  for select to authenticated using (public.can_access_chat(group_id));
create policy "chat_messages: post with access" on public.chat_messages
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_access_chat(group_id));
create policy "chat_messages: delete own" on public.chat_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- group_links: only members and guests can read the invite link; only the admin sets it
create policy "group_links: read with access" on public.group_links
  for select to authenticated using (public.can_access_chat(group_id));
create policy "group_links: admin insert" on public.group_links
  for insert to authenticated with check (public.is_group_admin(group_id));
create policy "group_links: admin update" on public.group_links
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "group_links: admin delete" on public.group_links
  for delete to authenticated using (public.is_group_admin(group_id));

-- notifications: your own only; you can mark them read or delete them (rows come from triggers)
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- friendships (unused for now): read-only for the two people involved
create policy "friendships: read own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

-- ---------- Realtime ----------
-- Broadcast new chat messages and notifications (Realtime respects the RLS policies above)
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notifications;

-- ---------- Storage (Supabase Storage buckets for uploaded files) ----------
-- avatars:       avatars/<user_id>/avatar               (images, max 2 MB) — you write only your own folder
-- event-posters: event-posters/<group_id>/<event_id>    (PDF or images, max 10 MB) — organizer or admin
-- Both buckets are public for reading, so the app shows the files with a plain URL.
-- The select policies are needed by the Storage API to overwrite (upsert) a file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/*']),
  ('event-posters', 'event-posters', true, 10485760, array['application/pdf', 'image/*'])
on conflict (id) do nothing;

create policy "avatars: see own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The second path segment is the event id: the event's organizer or the group's admin may write it
create policy "event-posters: see managed" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-posters' and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 2) and public.can_manage_event(e.id)));
create policy "event-posters: upload managed" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-posters' and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 2) and public.can_manage_event(e.id)));
create policy "event-posters: replace managed" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-posters' and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 2) and public.can_manage_event(e.id)));
create policy "event-posters: delete managed" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-posters' and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 2) and public.can_manage_event(e.id)));
