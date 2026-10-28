-- =============================================================================
-- Huddle — update of 01/11/2026: the group's mascot (it grows with the group's level), sharing
-- public events and holidays in group chats
-- For a Supabase project that already ran 20261031_ricorrenze_eventi_voti_account.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- ---------- Columns ----------

-- The group's mascot: one of the species drawn in components/Mascot.tsx (null = not chosen yet)
alter table public.groups add column if not exists mascot text;
alter table public.groups drop constraint if exists groups_mascot_check;
alter table public.groups add constraint groups_mascot_check
  check (mascot is null or mascot in ('fox', 'cat', 'panda', 'frog', 'penguin', 'dragon'));

-- A chat message can carry an event or holiday (shared from its page)
alter table public.chat_messages add column if not exists event_id uuid references public.events (id) on delete set null;

-- ---------- Functions ----------

-- The group's level, for the mascot and the clan: experience = people at past events (+ 2 per event).
-- For whoever sees the group (counts only). Keep the stages in sync with lib/mascot.ts.
create or replace function public.group_level(gid uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'events', count(distinct e.id),
    'trips', count(distinct e.id) filter (where e.kind = 'trip'),
    'attendances', count(a.user_id),
    'xp', count(a.user_id) + 2 * count(distinct e.id)
  )
  from public.events e
  left join public.event_attendees a on a.event_id = e.id and (a.status = 'going' or a.checked_in)
  where e.group_id = gid and e.date_time <= now() and e.cancelled_at is null and public.can_see_group(gid);
$$;

-- A shared event must be one the sender sees, and either from this group or public (public event of a
-- public group): a private event can't leak into another group's chat
create or replace function public.check_shared_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_id is not null and not exists (
    select 1 from public.events e join public.groups g on g.id = e.group_id
    where e.id = new.event_id and public.can_see_event(e.id)
      and (e.group_id = new.group_id or (e.visibility = 'public' and g.visibility = 'public'))
  ) then
    raise exception 'Questo evento non si può condividere qui';
  end if;
  return new;
end;
$$;

-- ---------- Triggers ----------

drop trigger if exists before_chat_message on public.chat_messages;
create trigger before_chat_message
  before insert on public.chat_messages
  for each row execute function public.check_shared_event();

-- ---------- Who can call the functions ----------

revoke execute on function public.group_level(uuid) from public, anon;
grant execute on function public.group_level(uuid) to authenticated;
