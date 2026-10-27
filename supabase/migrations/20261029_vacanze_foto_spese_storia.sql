-- =============================================================================
-- Huddle — update of 29/10/2026: holidays (with a shared plan), event photos, shared expenses
-- (like Splitwise), the group's history
-- For a Supabase project that already ran 20261028_per_te_passaggi_ricorrenti.sql.
-- SQL Editor -> paste -> Run (once; running it again does no harm).
-- =============================================================================

-- New notification: someone added an expense that includes you, or paid you back
alter type public.notification_type add value if not exists 'expense';

-- ---------- Columns ----------

-- Shared expenses ("Spese") on the group's events: chosen by the admin (holidays always have them)
alter table public.groups add column if not exists expenses_enabled boolean not null default false;

-- A holiday ("Vacanza") is an event that lasts several days, with a plan (trip_items)
do $$ begin
  create type public.event_kind as enum ('event', 'trip');
exception when duplicate_object then null;
end $$;
alter table public.events
  add column if not exists kind public.event_kind not null default 'event',
  add column if not exists ends_at timestamptz;  -- holidays: the last day
alter table public.events drop constraint if exists events_ends_at_check;
alter table public.events add constraint events_ends_at_check check (ends_at is null or ends_at >= date_time);

-- ---------- Tables ----------

-- Holiday plan: things to do / to see, optionally on a day. Every member and guest can edit it.
create table if not exists public.trip_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  kind        text not null default 'todo' check (kind in ('todo', 'see')),  -- "Da fare" / "Da vedere"
  title       text not null check (char_length(title) between 1 and 200),
  day         date,
  done        boolean not null default false,
  created_by  uuid references public.users (id) on delete set null,
  updated_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trip_items_event_idx on public.trip_items (event_id, day);

-- Event photos: at most one per person per event (Storage bucket "event-photos", <event_id>/<user_id>).
-- Seen by whoever sees the group: for a public group, everyone, also from other groups.
create table if not exists public.event_photos (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  url         text not null,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Shared expenses of an event or holiday: who paid, and each person's share (in cents, euro).
-- A settlement ("Ho saldato") is an expense paid by the debtor with one share: the creditor.
-- Written only by add_expense, which checks the amounts.
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  paid_by        uuid not null references public.users (id) on delete cascade,
  amount_cents   integer not null check (amount_cents between 1 and 10000000),
  description    text not null check (char_length(description) between 1 and 100),
  is_settlement  boolean not null default false,
  created_by     uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists expenses_event_idx on public.expenses (event_id);

create table if not exists public.expense_shares (
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  amount_cents  integer not null check (amount_cents >= 0),
  primary key (expense_id, user_id)
);

-- ---------- Functions ----------

-- Check-in window: from 1 hour before the start to 6 hours after the end (holidays: the last day).
-- Keep in sync with lib/eventTiming.ts.
create or replace function public.is_checkin_open(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events
    where id = eid and now() between date_time - interval '1 hour' and coalesce(ends_at, date_time) + interval '6 hours'
  );
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
  select m.user_id, 'new_event', case when new.kind = 'trip' then 'Nuova vacanza 🏖️' else 'Nuovo evento' end,
    g.name || ': ' || new.title, g.id, new.id
  from public.group_members m
  join public.groups g on g.id = m.group_id
  where m.group_id = new.group_id and m.user_id is distinct from new.created_by;
  return new;
end;
$$;

-- Plan items: who changed them last, and when
create or replace function public.touch_trip_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.title := trim(new.title);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

-- "12,50 €"
create or replace function public.format_euro(cents integer)
returns text language sql immutable set search_path = '' as $$
  select replace(to_char(cents / 100.0, 'FM9999990.00'), '.', ',') || ' €';
$$;

-- Adds an expense (or a settlement) to an event. p_shares: [{"user_id": "…", "amount_cents": 250}, …],
-- summing up to the amount. Everyone involved must be a member or guest of the group. The people
-- with a share (except you) get a notification.
create or replace function public.add_expense(
  p_event uuid, p_description text, p_amount_cents integer, p_paid_by uuid, p_shares jsonb, p_settlement boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ev public.events;
  g public.groups;
  new_id uuid;
  total integer;
  outsiders integer;
  my_name text;
begin
  select * into ev from public.events where id = p_event;
  select * into g from public.groups where id = ev.group_id;
  if ev.id is null or not public.can_access_chat(ev.group_id) then
    raise exception 'Evento non trovato';
  end if;
  if ev.kind <> 'trip' and not g.expenses_enabled then
    raise exception 'Le spese condivise non sono attive in questo gruppo';
  end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then
    raise exception 'Scegli tra chi dividere la spesa';
  end if;
  select coalesce(sum((s ->> 'amount_cents')::integer), 0) into total from jsonb_array_elements(p_shares) s;
  if total <> p_amount_cents then
    raise exception 'Le quote non tornano con il totale';
  end if;
  if p_settlement and (jsonb_array_length(p_shares) <> 1 or (p_paid_by <> me and (p_shares -> 0 ->> 'user_id')::uuid <> me)) then
    raise exception 'Un saldo è tra te e un’altra persona';
  end if;
  -- payer and shares: members, guests or accepted requesters of the group
  select count(*) into outsiders
  from (select p_paid_by as uid union select (s ->> 'user_id')::uuid from jsonb_array_elements(p_shares) s) people
  where not exists (select 1 from public.group_members m where m.group_id = ev.group_id and m.user_id = people.uid)
    and not exists (
      select 1 from public.join_requests r
      where r.group_id = ev.group_id and r.user_id = people.uid and r.status in ('guest', 'accepted')
    );
  if outsiders > 0 then
    raise exception 'Si possono dividere le spese solo con chi fa parte del gruppo';
  end if;

  insert into public.expenses (event_id, paid_by, amount_cents, description, is_settlement, created_by)
  values (p_event, p_paid_by, p_amount_cents, trim(p_description), p_settlement, me)
  returning id into new_id;
  insert into public.expense_shares (expense_id, user_id, amount_cents)
  select new_id, (s ->> 'user_id')::uuid, (s ->> 'amount_cents')::integer from jsonb_array_elements(p_shares) s;

  select full_name into my_name from public.users where id = me;
  insert into public.notifications (user_id, type, title, body, group_id, event_id)
  select (s ->> 'user_id')::uuid, 'expense',
    case when p_settlement then my_name || ' ha registrato un saldo 💸' else my_name || ' ha aggiunto una spesa' end,
    case when p_settlement then public.format_euro(p_amount_cents) || ' per «' || ev.title || '»'
      else '«' || trim(p_description) || '» ' || public.format_euro(p_amount_cents) || ' · la tua parte '
        || public.format_euro((s ->> 'amount_cents')::integer) || ' (' || ev.title || ')' end,
    ev.group_id, ev.id
  from jsonb_array_elements(p_shares) s
  where (s ->> 'user_id')::uuid <> me and (s ->> 'amount_cents')::integer > 0;
  return new_id;
end;
$$;

-- The group's history, from its creation to today: past events and holidays (with how many came
-- and their photos) and who joined. For whoever sees the group: counts only, no attendee names.
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
        where e.group_id = g.id and e.date_time <= now()
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

-- ---------- Triggers ----------

drop trigger if exists before_trip_item_change on public.trip_items;
create trigger before_trip_item_change
  before insert or update on public.trip_items
  for each row execute function public.touch_trip_item();

-- ---------- Row Level Security ----------

alter table public.trip_items     enable row level security;
alter table public.event_photos   enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;

-- trip_items: members and guests read and edit the plan together
drop policy if exists "trip_items: read with access" on public.trip_items;
create policy "trip_items: read with access" on public.trip_items
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
drop policy if exists "trip_items: add with access" on public.trip_items;
create policy "trip_items: add with access" on public.trip_items
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.events e where e.id = event_id and e.kind = 'trip' and public.can_access_chat(e.group_id))
  );
drop policy if exists "trip_items: edit with access" on public.trip_items;
create policy "trip_items: edit with access" on public.trip_items
  for update to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id)))
  with check (exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id)));
drop policy if exists "trip_items: delete with access" on public.trip_items;
create policy "trip_items: delete with access" on public.trip_items
  for delete to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );

-- event_photos: seen like the group; your own photo once the event has started (1 hour before);
-- you or the group admin can remove it
drop policy if exists "event_photos: read" on public.event_photos;
create policy "event_photos: read" on public.event_photos
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_see_group(e.group_id))
  );
drop policy if exists "event_photos: add own" on public.event_photos;
create policy "event_photos: add own" on public.event_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id and public.can_access_chat(e.group_id) and e.date_time - interval '1 hour' <= now()
    )
  );
drop policy if exists "event_photos: replace own" on public.event_photos;
create policy "event_photos: replace own" on public.event_photos
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "event_photos: remove own or admin" on public.event_photos;
create policy "event_photos: remove own or admin" on public.event_photos
  for delete to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.events e where e.id = event_id and public.is_group_admin(e.group_id))
  );

-- expenses: members and guests see them; whoever added or paid an expense (or the admin) removes it
drop policy if exists "expenses: read with access" on public.expenses;
create policy "expenses: read with access" on public.expenses
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_id and public.can_access_chat(e.group_id))
  );
drop policy if exists "expenses: remove own or admin" on public.expenses;
create policy "expenses: remove own or admin" on public.expenses
  for delete to authenticated using (
    created_by = (select auth.uid()) or paid_by = (select auth.uid())
    or exists (select 1 from public.events e where e.id = event_id and public.is_group_admin(e.group_id))
  );
drop policy if exists "expense_shares: read with access" on public.expense_shares;
create policy "expense_shares: read with access" on public.expense_shares
  for select to authenticated using (
    exists (
      select 1 from public.expenses x join public.events e on e.id = x.event_id
      where x.id = expense_id and public.can_access_chat(e.group_id)
    )
  );

-- ---------- Storage: event photos ----------
-- event-photos/<event_id>/<user_id> (images, max 5 MB), public for reading like the posters

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 5242880, array['image/*'])
on conflict (id) do nothing;

drop policy if exists "event-photos: see own" on storage.objects;
create policy "event-photos: see own" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-photos' and split_part(name, '/', 2) = (select auth.uid())::text);
drop policy if exists "event-photos: upload own" on storage.objects;
create policy "event-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-photos' and split_part(name, '/', 2) = (select auth.uid())::text and exists (
    select 1 from public.events e where e.id::text = split_part(name, '/', 1) and public.can_access_chat(e.group_id)));
drop policy if exists "event-photos: replace own" on storage.objects;
create policy "event-photos: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-photos' and split_part(name, '/', 2) = (select auth.uid())::text);
drop policy if exists "event-photos: delete own or admin" on storage.objects;
create policy "event-photos: delete own or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-photos' and (
    split_part(name, '/', 2) = (select auth.uid())::text
    or exists (select 1 from public.events e where e.id::text = split_part(name, '/', 1) and public.is_group_admin(e.group_id))
  ));

-- ---------- Who can call the functions ----------

revoke execute on function public.add_expense(uuid, text, integer, uuid, jsonb, boolean), public.group_history(uuid) from public, anon;
grant execute on function public.add_expense(uuid, text, integer, uuid, jsonb, boolean), public.group_history(uuid) to authenticated;
