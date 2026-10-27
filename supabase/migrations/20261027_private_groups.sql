-- =============================================================================
-- Huddle — update of 27/10/2026: private groups and invite links
-- For a Supabase project that already ran supabase/schema.sql BEFORE this date
-- (run 20261027_group_icons.sql first if you haven't).
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

do $$ begin
  create type public.group_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;

-- Existing groups stay public; each gets its own invite code
alter table public.groups
  add column if not exists visibility public.group_visibility not null default 'public',
  add column if not exists invite_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

do $$ begin
  alter table public.groups add constraint groups_invite_code_key unique (invite_code);
exception when duplicate_table or duplicate_object then null;
end $$;
alter table public.groups drop constraint if exists groups_invite_code_check;
alter table public.groups add constraint groups_invite_code_check check (invite_code ~ '^[a-z0-9]{8,32}$');

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


-- Private groups (and their members and events) are visible only to who can see them
drop policy if exists "groups: read" on public.groups;
create policy "groups: read" on public.groups
  -- admin_id is read from the row itself: right after "create group" the helper function can't see it yet
  for select to authenticated using (visibility = 'public' or admin_id = (select auth.uid()) or public.can_see_group(id));
drop policy if exists "group_members: read" on public.group_members;
create policy "group_members: read" on public.group_members
  for select to authenticated using (public.can_see_group(group_id));
drop policy if exists "events: read" on public.events;
create policy "events: read" on public.events
  for select to authenticated using (public.can_see_group(group_id));

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

