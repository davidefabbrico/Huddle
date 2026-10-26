-- =============================================================================
-- Huddle — Supabase schema (PostgreSQL)
-- Run once on a fresh project: Supabase dashboard -> SQL Editor -> paste -> Run.
-- Mirrors lib/types.ts. Row Level Security is enabled on every table.
-- =============================================================================

-- ---------- Enums ----------

create type public.user_role   as enum ('solo', 'group');
create type public.user_intent as enum ('friends', 'group', 'friends_and_dating');
create type public.group_type  as enum ('closed', 'open_to_new');
create type public.member_role as enum ('admin', 'member');
create type public.join_status as enum ('pending', 'guest', 'accepted', 'rejected');
create type public.notification_type as enum
  ('join_request', 'request_accepted', 'request_guest', 'request_rejected', 'new_event', 'rank_up');

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

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 150),
  date_time   timestamptz not null,
  location    text not null default '',
  -- Optional poster ("locandina") in the Storage bucket "event-posters": a PDF or an image
  poster_url  text,
  poster_mime text check (poster_mime is null or poster_mime = 'application/pdf' or poster_mime like 'image/%'),
  created_at  timestamptz not null default now()
);
create index events_group_id_date_time_idx on public.events (group_id, date_time);
create index events_date_time_idx on public.events (date_time);

-- External chat of a group (WhatsApp, Telegram…). Kept out of "groups" because groups are
-- readable by every signed-in user, while an invite link must stay with members and guests.
create table public.group_links (
  group_id    uuid primary key references public.groups (id) on delete cascade,
  chat_url    text not null check (chat_url like 'https://%'),
  updated_at  timestamptz not null default now()
);

-- Check-ins at events: they drive the member ranks (lib/ranks.ts)
create table public.event_attendees (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  checked_in  boolean not null default false,
  primary key (event_id, user_id)
);

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

-- Unused in the MVP. Each pair is stored once, with user_a < user_b.
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

-- Members, guests and accepted requesters may use the lobby/chat
create or replace function public.can_access_chat(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_group_member(gid) or exists (
    select 1 from public.join_requests
    where group_id = gid
      and user_id = (select auth.uid())
      and status in ('guest', 'accepted')
  );
$$;

-- Rank name for a number of check-ins in a group. Keep in sync with lib/ranks.ts.
create or replace function public.rank_name(checkins integer)
returns text language sql immutable set search_path = '' as $$
  select case
    when checkins >= 15 then 'Leggenda vivente 👑'
    when checkins >= 10 then 'Colonna portante 🏛️'
    when checkins >= 6  then 'Anima della festa 🎉'
    when checkins >= 3  then 'Prezzemolo 🌿'
    when checkins >= 1  then 'Faccia nota 👋'
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
-- The app passes full_name/role/intent/is_relocated in signUp's options.data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.users (id, full_name, is_relocated, relocated_at, role, intent)
  values (
    new.id,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1), 'Utente'),
    coalesce((meta ->> 'is_relocated')::boolean, false),
    nullif(meta ->> 'relocated_at', '')::date,
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

-- Tell the group's members (except the admin) about a new event
create or replace function public.handle_new_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select m.user_id, 'new_event', 'Nuovo evento', g.name || ': ' || new.title, g.id, new.id
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.group_id = new.group_id and m.user_id <> g.admin_id;
  return new;
end;
$$;

create trigger on_event_created
  after insert on public.events
  for each row execute function public.handle_new_event();

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
  select count(*) into total
  from public.event_attendees a join public.events e on e.id = a.event_id
  where a.user_id = new.user_id and a.checked_in and e.group_id = gid;
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

-- ---------- Row Level Security ----------

alter table public.users           enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;
alter table public.join_requests   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.friendships     enable row level security;
alter table public.notifications   enable row level security;
alter table public.group_links     enable row level security;

-- users: any signed-in user can read profiles; you can only create/edit your own
create policy "users: read" on public.users
  for select to authenticated using (true);
create policy "users: insert own" on public.users
  for insert to authenticated with check (id = (select auth.uid()));
create policy "users: update own" on public.users
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- groups: readable by signed-in users; only the admin can create/edit/delete
create policy "groups: read" on public.groups
  for select to authenticated using (true);
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
  for select to authenticated using (true);
create policy "group_members: admin add" on public.group_members
  for insert to authenticated with check (public.is_group_admin(group_id));
create policy "group_members: admin update" on public.group_members
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "group_members: leave or admin remove" on public.group_members
  for delete to authenticated using (user_id = (select auth.uid()) or public.is_group_admin(group_id));

-- events: readable by signed-in users (home feed); managed by the group admin
create policy "events: read" on public.events
  for select to authenticated using (true);
create policy "events: admin insert" on public.events
  for insert to authenticated with check (public.is_group_admin(group_id));
create policy "events: admin update" on public.events
  for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "events: admin delete" on public.events
  for delete to authenticated using (public.is_group_admin(group_id));

-- event_attendees: visible to people with chat access; you RSVP for yourself.
-- checked_in = true is accepted only inside the check-in window, and a check-in can't be undone.
create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
create policy "event_attendees: rsvp self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
    and (not checked_in or public.is_checkin_open(event_id))
  );
create policy "event_attendees: check in self" on public.event_attendees
  for update to authenticated
  using (user_id = (select auth.uid()) and not checked_in)
  with check (user_id = (select auth.uid()) and (not checked_in or public.is_checkin_open(event_id)));
create policy "event_attendees: cancel rsvp" on public.event_attendees
  for delete to authenticated using (user_id = (select auth.uid()) and not checked_in);

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

-- friendships (unused in MVP): read-only for the two people involved
create policy "friendships: read own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

-- ---------- Realtime ----------
-- Broadcast new chat messages (Realtime respects the RLS policies above)
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.notifications;

-- ---------- Storage (Supabase Storage buckets for uploaded files) ----------
-- avatars:       avatars/<user_id>/avatar        (images, max 2 MB) — you write only your own folder
-- event-posters: event-posters/<group_id>/<id>   (PDF or images, max 10 MB) — only the group admin writes
-- Both buckets are public for reading, so the app can show the files with a plain URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/*']),
  ('event-posters', 'event-posters', true, 10485760, array['application/pdf', 'image/*'])
on conflict (id) do nothing;

create policy "avatars: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "event-posters: admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-posters' and public.is_group_admin(((storage.foldername(name))[1])::uuid));
create policy "event-posters: admin replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-posters' and public.is_group_admin(((storage.foldername(name))[1])::uuid));
create policy "event-posters: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-posters' and public.is_group_admin(((storage.foldername(name))[1])::uuid));
