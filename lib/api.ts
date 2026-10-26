// Data-access layer on Supabase. Screens and hooks import ONLY from this file.
// Who can read/write what is enforced by Row Level Security (supabase/schema.sql);
// notifications are created by database triggers.

import { appUrl } from './appUrl';
import { validateChatLink } from './chatLinks';
import { normalizeParkingCode, validateParkingCode } from './smartpark';
import { CHECKIN_CLOSES_AFTER_MS } from './eventTiming';
import { isAttended, pointsBreakdown } from './points';
import { rankFor, type Rank } from './ranks';
import { supabase } from './supabase';
import type {
  AdminGroup,
  AttendeeWithProfile,
  CarSpot,
  ChatMessageWithAuthor,
  ChatPreview,
  Event,
  EventAttendee,
  EventWithGroup,
  Group,
  GroupLinks,
  GroupSummary,
  JoinRequest,
  JoinRequestWithUser,
  JoinStatus,
  LeaderboardEntry,
  Membership,
  MemberWithProfile,
  NewEventInput,
  NewGroupInput,
  Notification,
  PickedFile,
  ProfileStats,
  RsvpStatus,
  SignUpInput,
  SignUpResult,
  Thanks,
  Transport,
  User,
} from './types';

// Rows come back untyped from supabase-js; each function maps them to lib/types.ts shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// ---- Errors ----

// Supabase/Auth messages -> Italian
const errorMessages: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email o password non validi'],
  [/email not confirmed/i, 'Prima conferma l’email: apri il link che ti abbiamo mandato (guarda anche nello spam)'],
  [/user already registered|already been registered/i, 'Esiste già un account con questa email'],
  [/password should be at least|weak password/i, 'La password deve avere almeno 6 caratteri'],
  [/should be different from the old password/i, 'La nuova password deve essere diversa da quella attuale'],
  [/rate limit|too many requests|for security purposes/i, 'Troppi tentativi: riprova tra qualche minuto'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'Email non valida'],
  [/row-level security|permission denied/i, 'Non hai i permessi per questa azione'],
  [/duplicate key/i, 'Già fatto'],
  [/auth session missing|jwt expired/i, 'Sessione scaduta: accedi di nuovo'],
  [/failed to fetch|network request failed|load failed/i, 'Connessione assente: controlla internet e riprova'],
];

function toError(error: { message?: string } | null | undefined): Error {
  const message = error?.message ?? 'Errore sconosciuto';
  return new Error(errorMessages.find(([pattern]) => pattern.test(message))?.[1] ?? message);
}

function check<T>(result: { data: T; error: { message?: string } | null }): NonNullable<T> {
  if (result.error) throw toError(result.error);
  return result.data as NonNullable<T>;
}

// ---- Row mappers ----

const EVENT_SELECT = '*, groups(name, icon, color)';
const AUTHOR_SELECT = '*, users(id, full_name, is_relocated, avatar_url, avatar_seed)';

function toEvent(row: Row): EventWithGroup {
  return {
    id: row.id,
    group_id: row.group_id,
    created_by: row.created_by,
    title: row.title,
    date_time: row.date_time,
    location: row.location,
    lat: row.lat,
    lon: row.lon,
    poster_url: row.poster_url,
    poster_mime: row.poster_mime,
    group_name: row.groups?.name ?? '',
    group_icon: row.groups?.icon ?? null,
    group_color: row.groups?.color ?? null,
  };
}

function toMessage(row: Row): ChatMessageWithAuthor {
  return {
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    author: row.users ?? { id: row.user_id, full_name: 'Utente', is_relocated: false, avatar_url: null, avatar_seed: null },
  };
}

// ---- Files (Supabase Storage) ----

// Uploads a picked file (blob: URL on web, file:// on the phone) and returns its public URL.
// "?v=" makes browsers show the new file when it replaces an old one at the same path.
async function uploadFile(bucket: 'avatars' | 'event-posters', path: string, file: PickedFile): Promise<string> {
  const body = await (await fetch(file.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: file.mimeType, upsert: true });
  if (error) throw toError(error);
  return `${supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}

// ---- Auth ----

// The signed-in user's profile, or null (used at startup to restore the session)
export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  return id ? getUserById(id) : null;
}

export type AuthEvent = 'signed_in' | 'signed_out' | 'password_recovery';

// Session changes coming from outside the screens: email links, expiry, other tabs.
// Don't call Supabase directly inside the callback (supabase-js warns about deadlocks): defer it.
export function onAuthEvent(callback: (event: AuthEvent, userId: string | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user.id ?? null;
    if (event === 'PASSWORD_RECOVERY') callback('password_recovery', userId);
    else if (event === 'SIGNED_IN') callback('signed_in', userId);
    else if (event === 'SIGNED_OUT') callback('signed_out', null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toError(error);
  const user = await getUserById(data.user.id);
  if (!user) throw new Error('Profilo non trovato');
  return user;
}

// Creates the account. The handle_new_user trigger creates the profile from options.data.
// With email confirmation on (Supabase default), there is no session until the user clicks the link.
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: appUrl('/'),
      data: {
        full_name: input.full_name.trim(),
        role: input.role,
        intent: input.intent,
        is_relocated: input.is_relocated,
        relocated_at: input.is_relocated ? input.relocated_at : null,
        interests: input.interests ?? [],
      },
    },
  });
  if (error) throw toError(error);
  // Supabase answers an existing, confirmed email with a user without identities (no error, to hide it)
  if (data.user && data.user.identities?.length === 0) throw new Error('Esiste già un account con questa email');
  if (!data.session || !data.user) return { user: null, needsEmailConfirmation: true };
  return { user: await getUserById(data.user.id), needsEmailConfirmation: false };
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl('/') } });
  if (error) throw toError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toError(error);
}

// Sends the "reset your password" email; its link opens the app's /reset-password page
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/reset-password') });
  if (error) throw toError(error);
}

// New password for the signed-in user (also used after the reset email link)
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw toError(error);
}

export async function getCurrentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

// ---- Users ----

export async function getUserById(userId: string): Promise<User | null> {
  return check(await supabase.from('users').select('*').eq('id', userId).maybeSingle()) as User | null;
}

export async function updateProfile(userId: string, changes: Partial<Omit<User, 'id'>>): Promise<User> {
  if (changes.full_name !== undefined && !changes.full_name.trim()) throw new Error('Il nome non può essere vuoto');
  const patch = { ...changes };
  if (patch.is_relocated === false) patch.relocated_at = null;
  return check(await supabase.from('users').update(patch).eq('id', userId).select().single()) as User;
}

export async function uploadAvatar(userId: string, file: PickedFile): Promise<string> {
  return uploadFile('avatars', `${userId}/avatar`, file);
}

// ---- Groups ----

export async function getGroups(): Promise<GroupSummary[]> {
  const rows: Row[] = check(
    await supabase.from('groups').select('*, group_members(user_id, users(is_relocated))').order('created_at'),
  );
  return rows.map(({ group_members, ...group }) => ({
    ...group,
    member_count: group_members.length,
    relocated_count: group_members.filter((m: Row) => m.users?.is_relocated).length,
  }));
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  return check(await supabase.from('groups').select('*').eq('id', groupId).maybeSingle()) as Group | null;
}

export async function getGroupMembers(groupId: string): Promise<MemberWithProfile[]> {
  const rows: Row[] = check(await supabase.from('group_members').select('role, users(*)').eq('group_id', groupId));
  return rows
    .filter((r) => r.users)
    .map((r) => ({ ...r.users, member_role: r.role }))
    // Admin first, then alphabetical
    .sort((a, b) => (a.member_role === b.member_role ? a.full_name.localeCompare(b.full_name) : a.member_role === 'admin' ? -1 : 1));
}

// The creator becomes admin (on_group_created trigger)
function validateLinks(input: Partial<NewGroupInput>) {
  const error = validateChatLink(input.chat_url ?? '') ?? validateParkingCode(input.parking_code ?? '');
  if (error) throw new Error(error);
}

export async function createGroup(userId: string, input: NewGroupInput): Promise<Group> {
  if (!input.name.trim()) throw new Error('Dai un nome al gruppo');
  validateLinks(input);
  const group: Group = check(
    await supabase
      .from('groups')
      .insert({
        name: input.name.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        type: input.type,
        icon: input.icon ?? null,
        color: input.color ?? null,
        admin_id: userId,
      })
      .select()
      .single(),
  );
  await setGroupLinks(group.id, { chat_url: input.chat_url ?? null, parking_code: input.parking_code ?? null });
  return group;
}

export async function updateGroup(groupId: string, changes: Partial<NewGroupInput>): Promise<Group> {
  if (changes.name !== undefined && !changes.name.trim()) throw new Error('Dai un nome al gruppo');
  const { chat_url, parking_code, ...fields } = changes;
  if (chat_url !== undefined || parking_code !== undefined) {
    validateLinks(changes);
    const current = await getGroupLinks(groupId);
    await setGroupLinks(groupId, {
      chat_url: chat_url !== undefined ? chat_url : current.chat_url,
      parking_code: parking_code !== undefined ? parking_code : current.parking_code,
    });
  }
  return check(await supabase.from('groups').update(fields).eq('id', groupId).select().single()) as Group;
}

// One row per group; removed when both links are empty
async function setGroupLinks(groupId: string, links: GroupLinks) {
  const chat_url = links.chat_url?.trim() || null;
  const parking_code = links.parking_code?.trim() ? normalizeParkingCode(links.parking_code) : null;
  if (chat_url || parking_code) {
    check(await supabase.from('group_links').upsert({ group_id: groupId, chat_url, parking_code, updated_at: new Date().toISOString() }));
  } else {
    check(await supabase.from('group_links').delete().eq('group_id', groupId));
  }
}

// External chat and SmartPark code: only members and guests get them (RLS on group_links)
export async function getGroupLinks(groupId: string): Promise<GroupLinks> {
  const row: Row = check(await supabase.from('group_links').select('chat_url, parking_code').eq('group_id', groupId).maybeSingle());
  return { chat_url: row?.chat_url ?? null, parking_code: row?.parking_code ?? null };
}

// Your answers to events, with each event's group and date (for ranks and points)
async function myAttendance(userId: string) {
  const rows: Row[] = check(
    await supabase.from('event_attendees').select('status, checked_in, events(*)').eq('user_id', userId),
  );
  return rows.filter((r) => r.events).map((r) => ({ status: r.status, checked_in: r.checked_in, event: r.events as Event }));
}

export async function getMemberships(userId: string): Promise<Membership[]> {
  const [rows, attendance]: [Row[], Awaited<ReturnType<typeof myAttendance>>] = await Promise.all([
    supabase.from('group_members').select('role, groups(*)').eq('user_id', userId).then(check),
    myAttendance(userId),
  ]);
  return rows
    .filter((r) => r.groups)
    .map((r) => ({
      group: r.groups as Group,
      member_role: r.role,
      attended_events: attendance.filter((a) => a.event.group_id === r.groups.id && isAttended(a, a.event.date_time)).length,
    }))
    .sort((a, b) => b.attended_events - a.attended_events);
}

// Groups you administer, with pending requests
export async function getAdminGroups(userId: string): Promise<AdminGroup[]> {
  const rows: Row[] = check(await supabase.from('groups').select('*, join_requests(status)').eq('admin_id', userId));
  return rows.map(({ join_requests, ...group }) => ({
    group,
    pending_requests: join_requests.filter((r: Row) => r.status === 'pending').length,
  }));
}

// ---- Points & profile ----

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const nowIso = new Date().toISOString();
  const [memberships, attendance, organized, thanksReceived, thanksSent, passengerRows] = await Promise.all([
    getMemberships(userId),
    myAttendance(userId),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('created_by', userId).lte('date_time', nowIso),
    supabase.from('thanks').select('id', { count: 'exact', head: true }).eq('to_user', userId),
    supabase.from('thanks').select('id', { count: 'exact', head: true }).eq('from_user', userId),
    supabase.from('event_attendees').select('status, checked_in, events(date_time)').eq('ride_with', userId).then(check),
  ]);
  const attendedEvents = attendance.filter((a) => isAttended(a, a.event.date_time)).map((a) => a.event);
  const passengers = (passengerRows as Row[]).filter((r) => r.events && isAttended(r, r.events.date_time)).length;
  return {
    ...pointsBreakdown(organized.count ?? 0, attendedEvents.length, thanksReceived.count ?? 0, passengers),
    memberships,
    attended_events: attendedEvents,
    thanks_sent: thanksSent.count ?? 0,
  };
}

// Points of each member, counting only this group's events (members and guests can see it)
export async function getGroupLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const now = Date.now();
  const [members, events, answers, thanks]: [MemberWithProfile[], Row[], Row[], Row[]] = await Promise.all([
    getGroupMembers(groupId),
    supabase.from('events').select('id, created_by, date_time').eq('group_id', groupId).then(check),
    supabase
      .from('event_attendees')
      .select('user_id, status, checked_in, ride_with, events!inner(group_id, date_time)')
      .eq('events.group_id', groupId)
      .then(check),
    supabase.from('thanks').select('to_user, events!inner(group_id)').eq('events.group_id', groupId).then(check),
  ]);
  return members
    .map(({ member_role: _role, ...user }) => {
      const organized = events.filter((e) => e.created_by === user.id && new Date(e.date_time).getTime() <= now).length;
      const attended = answers.filter((a) => a.user_id === user.id && isAttended(a, a.events.date_time, now)).length;
      const received = thanks.filter((t) => t.to_user === user.id).length;
      const passengers = answers.filter((a) => a.ride_with === user.id && isAttended(a, a.events.date_time, now)).length;
      return { user, ...pointsBreakdown(organized, attended, received, passengers) };
    })
    .sort((a, b) => b.points - a.points || a.user.full_name.localeCompare(b.user.full_name));
}

// ---- Events ----

// Upcoming and live events (live = started less than 6 hours ago, see lib/eventTiming.ts)
export async function getUpcomingEvents(limit = 50): Promise<EventWithGroup[]> {
  const since = new Date(Date.now() - CHECKIN_CLOSES_AFTER_MS).toISOString();
  const rows: Row[] = check(
    await supabase.from('events').select(EVENT_SELECT).gte('date_time', since).order('date_time').limit(limit),
  );
  return rows.map(toEvent);
}

export async function getGroupEvents(groupId: string): Promise<EventWithGroup[]> {
  const since = new Date(Date.now() - CHECKIN_CLOSES_AFTER_MS).toISOString();
  const rows: Row[] = check(
    await supabase.from('events').select(EVENT_SELECT).eq('group_id', groupId).gte('date_time', since).order('date_time'),
  );
  return rows.map(toEvent);
}

export async function getEventById(eventId: string): Promise<EventWithGroup | null> {
  const row: Row = check(await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).maybeSingle());
  return row ? toEvent(row) : null;
}

// Any member can organize. The organizer is automatically "Ci sono" and the members get a notification (triggers).
export async function createEvent(userId: string, input: NewEventInput): Promise<EventWithGroup> {
  if (!input.title.trim()) throw new Error('Dai un titolo all’evento');
  const row: Row = check(
    await supabase
      .from('events')
      .insert({
        group_id: input.group_id,
        created_by: userId,
        title: input.title.trim(),
        date_time: input.date_time,
        location: input.location.trim(),
        lat: input.lat ?? null,
        lon: input.lon ?? null,
      })
      .select(EVENT_SELECT)
      .single(),
  );
  const event = toEvent(row);
  return input.poster ? setEventPoster(event, input.poster) : event;
}

// Organizer or admin: add, replace or remove (file = null) the poster
export async function setEventPoster(event: Pick<Event, 'id' | 'group_id'>, file: PickedFile | null): Promise<EventWithGroup> {
  const path = `${event.group_id}/${event.id}`;
  let poster = { poster_url: null as string | null, poster_mime: null as string | null };
  if (file) {
    poster = { poster_url: await uploadFile('event-posters', path, file), poster_mime: file.mimeType };
  } else {
    await supabase.storage.from('event-posters').remove([path]);
  }
  const row: Row = check(await supabase.from('events').update(poster).eq('id', event.id).select(EVENT_SELECT).single());
  return toEvent(row);
}

// Organizer or admin
export async function deleteEvent(eventId: string): Promise<void> {
  check(await supabase.from('events').delete().eq('id', eventId));
}

// Everyone who answered, "Ci sono" first (people on site first), then "Non ci sono"
export async function getEventAttendees(eventId: string): Promise<AttendeeWithProfile[]> {
  const rows: Row[] = check(
    // users!…user_id: the person who answered (ride_with is a second link to users, the driver)
    await supabase
      .from('event_attendees')
      .select('status, checked_in, transport, seats, ride_with, users!event_attendees_user_id_fkey(*)')
      .eq('event_id', eventId),
  );
  return rows
    .filter((r) => r.users)
    .map((r) => ({ ...r.users, status: r.status, checked_in: r.checked_in, transport: r.transport, seats: r.seats, ride_with: r.ride_with }))
    .sort(
      (a, b) =>
        Number(a.status === 'not_going') - Number(b.status === 'not_going') ||
        Number(b.checked_in) - Number(a.checked_in) ||
        a.full_name.localeCompare(b.full_name),
    );
}

export async function getAttendance(userId: string, eventId: string): Promise<EventAttendee | null> {
  return check(
    await supabase.from('event_attendees').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
  ) as EventAttendee | null;
}

// Your answers to events: event_id -> answer (for the badges on event cards)
export async function getMyAnswers(userId: string): Promise<Record<string, EventAttendee>> {
  const rows: EventAttendee[] = check(await supabase.from('event_attendees').select('*').eq('user_id', userId));
  return Object.fromEntries(rows.map((r) => [r.event_id, r]));
}

// "Ci sono" / "Non ci sono"; null removes the answer (not possible after a check-in)
export async function setRsvp(userId: string, eventId: string, status: RsvpStatus | null): Promise<void> {
  if (status === null) {
    check(await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId));
  } else {
    check(await supabase.from('event_attendees').upsert({ event_id: eventId, user_id: userId, status }));
  }
}

// "Sono qui" while the event is live. Returns the new rank if you climbed one (the database also notifies you).
export async function checkIn(userId: string, event: Pick<Event, 'id' | 'group_id' | 'date_time'>): Promise<{ newRank: Rank | null }> {
  const attendance = (await myAttendance(userId)).filter((a) => a.event.group_id === event.group_id);
  const before = attendance.filter((a) => isAttended(a, a.event.date_time)).length;
  const alreadyCounted = attendance.some((a) => a.event.id === event.id && isAttended(a, a.event.date_time));
  check(
    await supabase.from('event_attendees').upsert({ event_id: event.id, user_id: userId, status: 'going', checked_in: true }),
  );
  const after = alreadyCounted ? before : before + 1;
  return { newRank: rankFor(after).level > rankFor(before).level ? rankFor(after) : null };
}

// ---- Getting there: carpool and where the car is ----

// "In auto" (with free seats), "Mi serve un passaggio" or "Per conto mio" (you're "Ci sono").
// The database frees your passengers if you stop driving.
export async function setTransport(userId: string, eventId: string, transport: Transport, seats = 0): Promise<void> {
  check(
    await supabase
      .from('event_attendees')
      .upsert({ event_id: eventId, user_id: userId, status: 'going', transport, seats: transport === 'car' ? seats : 0 }),
  );
}

// Get in a driver's car (null = get out). The database checks the free seats and notifies the driver.
export async function rideWith(userId: string, eventId: string, driverId: string | null): Promise<void> {
  check(
    await supabase
      .from('event_attendees')
      .upsert({ event_id: eventId, user_id: userId, status: 'going', transport: 'need_ride', ride_with: driverId }),
  );
}

// Car positions you can see for this event: yours, and your driver's if they shared it (RLS)
export async function getCarSpots(eventId: string): Promise<CarSpot[]> {
  return check(await supabase.from('car_spots').select('event_id, user_id, lat, lon').eq('event_id', eventId)) as CarSpot[];
}

// Driver only: show your passengers where you left the car (from SmartPark)
export async function shareCarSpot(userId: string, eventId: string, lat: number, lon: number): Promise<void> {
  check(
    await supabase
      .from('car_spots')
      .upsert({ event_id: eventId, user_id: userId, lat, lon, shared_at: new Date().toISOString() }),
  );
}

export async function stopSharingCarSpot(userId: string, eventId: string): Promise<void> {
  check(await supabase.from('car_spots').delete().eq('event_id', eventId).eq('user_id', userId));
}

// ---- Thanks ----

export async function getEventThanks(eventId: string): Promise<Thanks[]> {
  return check(await supabase.from('thanks').select('id, event_id, from_user, to_user').eq('event_id', eventId)) as Thanks[];
}

export async function sendThanks(eventId: string, fromUser: string, toUser: string): Promise<void> {
  check(await supabase.from('thanks').insert({ event_id: eventId, from_user: fromUser, to_user: toUser }));
}

export async function removeThanks(eventId: string, fromUser: string, toUser: string): Promise<void> {
  check(await supabase.from('thanks').delete().eq('event_id', eventId).eq('from_user', fromUser).eq('to_user', toUser));
}

// ---- Join requests ----

export async function getJoinRequest(userId: string, groupId: string): Promise<JoinRequest | null> {
  return check(
    await supabase.from('join_requests').select('*').eq('user_id', userId).eq('group_id', groupId).maybeSingle(),
  ) as JoinRequest | null;
}

// Creates a pending request (the admin gets a notification). A rejected user may ask again.
export async function requestToJoin(userId: string, groupId: string): Promise<JoinRequest> {
  const existing = await getJoinRequest(userId, groupId);
  if (existing && existing.status !== 'rejected') return existing;
  if (existing) check(await supabase.from('join_requests').delete().eq('id', existing.id));
  const { data, error } = await supabase.from('join_requests').insert({ user_id: userId, group_id: groupId }).select().single();
  if (error) {
    throw /row-level security/i.test(error.message) ? new Error('Questo gruppo al momento non accetta nuovi membri') : toError(error);
  }
  return data as JoinRequest;
}

// Requests an admin still has to handle (pending first, then guests)
export async function getGroupJoinRequests(groupId: string): Promise<JoinRequestWithUser[]> {
  const rows: Row[] = check(
    await supabase.from('join_requests').select('*, users(*)').eq('group_id', groupId).in('status', ['pending', 'guest']),
  );
  return rows
    .map(({ users, ...request }) => ({ ...request, user: users }))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));
}

// Admin. On 'accepted' the database adds the member; the requester gets a notification.
export async function updateJoinRequestStatus(requestId: string, status: JoinStatus): Promise<JoinRequest> {
  return check(await supabase.from('join_requests').update({ status }).eq('id', requestId).select().single()) as JoinRequest;
}

// Members, guests and accepted requesters (same SQL function as the RLS policies)
export async function canAccessChat(groupId: string): Promise<boolean> {
  return Boolean(check(await supabase.rpc('can_access_chat', { gid: groupId })));
}

// ---- Notifications (Attività) ----

export async function getNotifications(userId: string): Promise<Notification[]> {
  return check(
    await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
  ) as Notification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw toError(error);
  return count ?? 0;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  check(
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null),
  );
}

// ---- Chat ----

export async function getMessages(groupId: string): Promise<ChatMessageWithAuthor[]> {
  const rows: Row[] = check(
    await supabase.from('chat_messages').select(AUTHOR_SELECT).eq('group_id', groupId).order('created_at').limit(300),
  );
  return rows.map(toMessage);
}

// Chats you can open (member, guest or accepted), most recent activity first
export async function getMyChats(userId: string): Promise<ChatPreview[]> {
  const [memberRows, requestRows]: [Row[], Row[]] = await Promise.all([
    supabase.from('group_members').select('groups(*)').eq('user_id', userId).then(check),
    supabase.from('join_requests').select('status, groups(*)').eq('user_id', userId).in('status', ['guest', 'accepted']).then(check),
  ]);
  const chats = new Map<string, ChatPreview>();
  for (const r of requestRows) if (r.groups) chats.set(r.groups.id, { group: r.groups, access: r.status, last_message: null });
  for (const r of memberRows) if (r.groups) chats.set(r.groups.id, { group: r.groups, access: 'member', last_message: null });
  if (chats.size === 0) return [];

  const latest: Row[] = check(
    await supabase
      .from('chat_messages')
      .select(AUTHOR_SELECT)
      .in('group_id', [...chats.keys()])
      .order('created_at', { ascending: false })
      .limit(300),
  );
  for (const row of latest) {
    const chat = chats.get(row.group_id);
    if (chat && !chat.last_message) chat.last_message = toMessage(row);
  }
  return [...chats.values()].sort((a, b) => (b.last_message?.created_at ?? '').localeCompare(a.last_message?.created_at ?? ''));
}

export async function sendMessage(groupId: string, userId: string, content: string): Promise<ChatMessageWithAuthor> {
  const text = content.trim();
  if (!text) throw new Error('Il messaggio è vuoto');
  const row: Row = check(
    await supabase.from('chat_messages').insert({ group_id: groupId, user_id: userId, content: text }).select(AUTHOR_SELECT).single(),
  );
  return toMessage(row);
}

// Realtime: calls onMessage for every new message in the group. Returns an unsubscribe function.
// onReady fires when the subscription is live: reload then, to catch messages sent while connecting.
// Realtime confirms the channel (SUBSCRIBED) slightly before the database feed is attached
// ("Subscribed to PostgreSQL"): messages in between would be missed, so onReady fires at both.
export function subscribeToMessages(
  groupId: string,
  onMessage: (message: ChatMessageWithAuthor) => void,
  onReady?: () => void,
): () => void {
  const authors = new Map<string, Promise<User | null>>(); // cache profiles while the chat is open
  const channel = supabase
    .channel(`chat:${groupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, (payload) => {
      const row = payload.new as Row;
      if (!authors.has(row.user_id)) authors.set(row.user_id, getUserById(row.user_id));
      authors.get(row.user_id)!.then((user) => onMessage(toMessage({ ...row, users: user })));
    })
    .on('system', {}, (payload: { extension?: string; status?: string }) => {
      if (payload?.extension === 'postgres_changes' && payload.status === 'ok') onReady?.();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onReady?.();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
