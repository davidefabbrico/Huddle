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

-- ---------- Tables ----------

-- Public profile, 1:1 with auth.users (email/password live in auth.users)
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 1 and 100),
  bio           text not null default '',
  is_relocated  boolean not null default false,
  interests     text[] not null default '{}',
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
  created_at  timestamptz not null default now()
);
create index events_group_id_date_time_idx on public.events (group_id, date_time);
create index events_date_time_idx on public.events (date_time);

-- Unused in the MVP
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

-- ---------- Triggers ----------

-- Create the public profile when someone signs up.
-- The app passes full_name/role/intent/is_relocated in signUp's options.data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.users (id, full_name, is_relocated, role, intent)
  values (
    new.id,
    coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1), 'Utente'),
    coalesce((meta ->> 'is_relocated')::boolean, false),
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

-- Keep updated_at fresh, and add the member when a request is accepted
create or replace function public.handle_join_request_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.group_members (user_id, group_id, role)
    values (new.user_id, new.group_id, 'member')
    on conflict (user_id, group_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_join_request_updated
  before update on public.join_requests
  for each row execute function public.handle_join_request_update();

-- ---------- Row Level Security ----------

alter table public.users           enable row level security;
alter table public.groups          enable row level security;
alter table public.group_members   enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;
alter table public.join_requests   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.friendships     enable row level security;

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

-- event_attendees (unused in MVP): visible to people with chat access; you RSVP for yourself
create policy "event_attendees: read" on public.event_attendees
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
create policy "event_attendees: rsvp self" on public.event_attendees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
create policy "event_attendees: update self" on public.event_attendees
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "event_attendees: cancel self" on public.event_attendees
  for delete to authenticated using (user_id = (select auth.uid()));

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

-- friendships (unused in MVP): read-only for the two people involved
create policy "friendships: read own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

-- ---------- Realtime ----------
-- Broadcast new chat messages (Realtime respects the RLS policies above)
alter publication supabase_realtime add table public.chat_messages;
