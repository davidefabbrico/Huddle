// Data-access layer on Supabase. Screens and hooks import ONLY from this file.
// Who can read/write what is enforced by Row Level Security (supabase/schema.sql);
// notifications are created by database triggers.

import { appUrl } from './appUrl';
import { validateChatLink } from './chatLinks';
import { normalizeParkingCode, validateParkingCode } from './smartpark';
import { CHECKIN_CLOSES_AFTER_MS } from './eventTiming';
import { isAttended, pointsBreakdown } from './points';
import { rankFor, type Rank } from './ranks';
import { eventTopics } from './recommendations';
import { supabase } from './supabase';
import type {
  AdminGroup,
  AttendeeWithProfile,
  CarSpot,
  ChatMessageWithAuthor,
  ChatPreview,
  Event,
  EventAttendee,
  EventChanges,
  EventGroupSummary,
  EventPhoto,
  EventWithGroup,
  Expense,
  ForYouSignals,
  Group,
  GroupHistory,
  GroupLinks,
  GroupSummary,
  HiddenGroup,
  InvitePreview,
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
  SeriesRegular,
  SignUpInput,
  SignUpResult,
  Thanks,
  Transport,
  TripItem,
  User,
  UserSettings,
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

const EVENT_SELECT =
  '*, groups!events_group_id_fkey(name, icon, color, type, age_min, age_max, is_business), event_series(id, weekdays, start_time, created_by, starts_on, ends_on)';
const AUTHOR_SELECT = `*, users(id, full_name, is_relocated, avatar_url, avatar_seed), events(${EVENT_SELECT})`;

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
    tags: row.tags ?? [],
    series_id: row.series_id ?? null,
    kind: row.kind ?? 'event',
    ends_at: row.ends_at ?? null,
    visibility: row.visibility ?? 'public',
    cancelled_at: row.cancelled_at ?? null,
    group_name: row.groups?.name ?? '',
    group_icon: row.groups?.icon ?? null,
    group_color: row.groups?.color ?? null,
    group_type: row.groups?.type ?? 'open_to_new',
    group_age_min: row.groups?.age_min ?? null,
    group_age_max: row.groups?.age_max ?? null,
    group_is_business: row.groups?.is_business ?? false,
    series: row.event_series ?? null,
  };
}

function toMessage(row: Row): ChatMessageWithAuthor {
  return {
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    event_id: row.event_id ?? null,
    author: row.users ?? { id: row.user_id, full_name: 'Utente', is_relocated: false, avatar_url: null, avatar_seed: null },
    event: row.events ? toEvent(row.events) : null,
  };
}

// ---- Files (Supabase Storage) ----

// Uploads a picked file (blob: URL on web, file:// on the phone) and returns its public URL.
// "?v=" makes browsers show the new file when it replaces an old one at the same path.
async function uploadFile(bucket: 'avatars' | 'event-posters' | 'event-photos', path: string, file: PickedFile): Promise<string> {
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
        account_type: input.account_type,
        adult: input.adult,
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

// "Cambia password": the current password first. Checked by signing in with it again (same account,
// the session is just renewed), then the new one is set.
export async function changePassword(current: string, next: string): Promise<void> {
  const email = await getCurrentEmail();
  if (!email) throw new Error('Accedi di nuovo per cambiare la password');
  const { error } = await supabase.auth.signInWithPassword({ email, password: current });
  if (error) throw new Error('La password attuale non è giusta');
  await updatePassword(next);
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

// Private settings (age, area, newsletter…): defaults until the row exists
export async function getMySettings(userId: string): Promise<UserSettings> {
  const row: Row = check(await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle());
  return {
    birth_year: row?.birth_year ?? null,
    area: row?.area ?? null,
    area_lat: row?.area_lat ?? null,
    area_lon: row?.area_lon ?? null,
    search_radius_km: row?.search_radius_km ?? 25,
    newsletter: row?.newsletter ?? true,
    accept_promos: row?.accept_promos ?? true,
  };
}

export async function updateMySettings(userId: string, changes: Partial<UserSettings>): Promise<void> {
  check(await supabase.from('user_settings').upsert({ user_id: userId, ...changes }));
}

// Deletes your account for good: your groups pass to the member who joined first (empty ones are
// deleted), your answers, messages, photos and settings go. Files first (best effort), then the data.
export async function deleteMyAccount(userId: string): Promise<void> {
  const photos: Row[] = check(await supabase.from('event_photos').select('event_id').eq('user_id', userId));
  if (photos.length) await supabase.storage.from('event-photos').remove(photos.map((p) => `${p.event_id}/${userId}`));
  await supabase.storage.from('avatars').remove([`${userId}/avatar`]);
  check(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut({ scope: 'local' });
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
        visibility: input.visibility ?? 'public',
        expenses_enabled: input.expenses_enabled ?? false,
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        age_min: input.age_min ?? null,
        age_max: input.age_max ?? null,
        tags: input.tags ?? [],
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

// Leave a group (any member except the admin, who deletes it instead).
// Your old request goes too, so you can ask again later.
export async function leaveGroup(userId: string, groupId: string): Promise<void> {
  check(await supabase.from('group_members').delete().eq('user_id', userId).eq('group_id', groupId));
  check(await supabase.from('join_requests').delete().eq('user_id', userId).eq('group_id', groupId));
}

// Admin: deletes the group and, with it, members, events, chat, thanks and points (cascade in the database)
export async function deleteGroup(groupId: string): Promise<void> {
  // Posters are files in Storage, not rows: remove them first (best effort)
  const posters: Row[] = check(await supabase.from('events').select('id').eq('group_id', groupId).not('poster_url', 'is', null));
  if (posters.length) await supabase.storage.from('event-posters').remove(posters.map((e) => `${groupId}/${e.id}`));
  const photos: Row[] = check(await supabase.from('event_photos').select('event_id, user_id, events!inner(group_id)').eq('events.group_id', groupId));
  if (photos.length) await supabase.storage.from('event-photos').remove(photos.map((p) => `${p.event_id}/${p.user_id}`));
  const { error, count } = await supabase.from('groups').delete({ count: 'exact' }).eq('id', groupId);
  if (error) throw toError(error);
  if (!count) throw new Error('Solo l’admin può eliminare il gruppo');
}

// Admin of a private group: a new invite link (the old one stops working)
export async function regenerateInviteCode(groupId: string): Promise<string> {
  const code = Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  check(await supabase.from('groups').update({ invite_code: code }).eq('id', groupId));
  return code;
}

// The group behind an invite link (also private ones), or null if the link is wrong
export async function getGroupByInvite(code: string): Promise<InvitePreview | null> {
  return check(await supabase.rpc('group_by_invite', { p_code: code })) as InvitePreview | null;
}

// "Chiedi di unirti" from an invite link: creates a pending request (the admin approves). Returns the status.
export async function requestJoinByInvite(code: string): Promise<string> {
  return check(await supabase.rpc('request_join_by_invite', { p_code: code })) as string;
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

// Your answers to events, with each event's group and date (for ranks and points; cancelled events don't count)
async function myAttendance(userId: string) {
  const rows: Row[] = check(
    await supabase.from('event_attendees').select('status, checked_in, events(*)').eq('user_id', userId),
  );
  return rows.filter((r) => r.events && !r.events.cancelled_at).map((r) => ({ status: r.status, checked_in: r.checked_in, event: r.events as Event }));
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
    // Occurrences of a recurring event don't count as organized (they'd be +10 every week)
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .is('series_id', null)
      .is('cancelled_at', null)
      .lte('date_time', nowIso),
    supabase.from('thanks').select('id', { count: 'exact', head: true }).eq('to_user', userId),
    supabase.from('thanks').select('id', { count: 'exact', head: true }).eq('from_user', userId),
    supabase
      .from('event_attendees')
      .select('status, checked_in, events(date_time, cancelled_at)')
      .eq('ride_with', userId)
      .eq('ride_status', 'accepted')
      .then(check),
  ]);
  const attendedEvents = attendance.filter((a) => isAttended(a, a.event.date_time)).map((a) => a.event);
  const passengers = (passengerRows as Row[]).filter((r) => r.events && !r.events.cancelled_at && isAttended(r, r.events.date_time)).length;
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
    // cancelled events don't count
    supabase.from('events').select('id, created_by, date_time, series_id').eq('group_id', groupId).is('cancelled_at', null).then(check),
    supabase
      .from('event_attendees')
      .select('user_id, status, checked_in, ride_with, ride_status, events!inner(group_id, date_time)')
      .eq('events.group_id', groupId)
      .is('events.cancelled_at', null)
      .then(check),
    supabase.from('thanks').select('to_user, events!inner(group_id)').eq('events.group_id', groupId).then(check),
  ]);
  return members
    .map(({ member_role: _role, ...user }) => {
      const organized = events.filter((e) => e.created_by === user.id && !e.series_id && new Date(e.date_time).getTime() <= now).length;
      const attended = answers.filter((a) => a.user_id === user.id && isAttended(a, a.events.date_time, now)).length;
      const received = thanks.filter((t) => t.to_user === user.id).length;
      const passengers = answers.filter(
        (a) => a.ride_with === user.id && a.ride_status === 'accepted' && isAttended(a, a.events.date_time, now),
      ).length;
      return { user, ...pointsBreakdown(organized, attended, received, passengers) };
    })
    .sort((a, b) => b.points - a.points || a.user.full_name.localeCompare(b.user.full_name));
}

// ---- Events ----

// Creates the next two weeks of occurrences of your groups' recurring events (no scheduled job needed:
// whoever lists events does it). Best effort: a failure only means fewer occurrences listed.
async function extendSeries(): Promise<void> {
  await supabase.rpc('extend_series');
}

const inTwoWeeks = () => new Date(Date.now() + 14 * 24 * 3600e3).toISOString();

// Upcoming and live events (live = started less than 6 hours ago, see lib/eventTiming.ts)
export async function getUpcomingEvents(limit = 50): Promise<EventWithGroup[]> {
  await extendSeries();
  const since = new Date(Date.now() - CHECKIN_CLOSES_AFTER_MS).toISOString();
  const rows: Row[] = check(
    // holidays stay listed until their last day
    await supabase
      .from('events')
      .select(EVENT_SELECT)
      .or(`date_time.gte.${since},ends_at.gte.${since}`)
      // a recurring event can have dates up to a year ahead: lists show its next two weeks
      .or(`series_id.is.null,date_time.lte.${inTwoWeeks()}`)
      .order('date_time')
      .limit(limit),
  );
  return rows.map(toEvent);
}

export async function getGroupEvents(groupId: string): Promise<EventWithGroup[]> {
  await extendSeries();
  const since = new Date(Date.now() - CHECKIN_CLOSES_AFTER_MS).toISOString();
  const rows: Row[] = check(
    await supabase
      .from('events')
      .select(EVENT_SELECT)
      .eq('group_id', groupId)
      .or(`date_time.gte.${since},ends_at.gte.${since}`)
      .or(`series_id.is.null,date_time.lte.${inTwoWeeks()}`)
      .order('date_time'),
  );
  return rows.map(toEvent);
}

export async function getEventById(eventId: string): Promise<EventWithGroup | null> {
  const row: Row = check(await supabase.from('events').select(EVENT_SELECT).eq('id', eventId).maybeSingle());
  return row ? toEvent(row) : null;
}

// Any member can organize. The organizer is automatically "Ci sono" and the members get a notification (triggers).
// With repeat_weekdays it creates a recurring event and returns its first occurrence.
export async function createEvent(userId: string, input: NewEventInput): Promise<EventWithGroup> {
  if (!input.title.trim()) throw new Error('Dai un titolo all’evento');
  const tags = input.tags?.length ? input.tags : eventTopics({ title: input.title, tags: [] }).slice(0, 5);
  if (input.repeat_weekdays?.length && input.kind !== 'trip') return createSeries(userId, { ...input, tags }, input.repeat_weekdays);
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
        tags,
        kind: input.kind ?? 'event',
        ends_at: input.kind === 'trip' ? (input.ends_at ?? null) : null,
        visibility: input.visibility ?? 'public',
      })
      .select(EVENT_SELECT)
      .single(),
  );
  const event = toEvent(row);
  return input.poster ? setEventPoster(event, input.poster) : event;
}

// ---- Recurring events ----

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The series keeps the time of date_time in the phone's time zone ("every Monday at 19:00"), from
// the day of date_time to repeat_until: all its dates are created now
async function createSeries(userId: string, input: NewEventInput, weekdays: number[]): Promise<EventWithGroup> {
  const start = new Date(input.date_time);
  const series: Row = check(
    await supabase
      .from('event_series')
      .insert({
        group_id: input.group_id,
        created_by: userId,
        title: input.title.trim(),
        weekdays,
        start_time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome',
        location: input.location.trim(),
        lat: input.lat ?? null,
        lon: input.lon ?? null,
        tags: input.tags ?? [],
        visibility: input.visibility ?? 'public',
        starts_on: localDay(start),
        ends_on: input.repeat_until ?? null,
      })
      .select('id')
      .single(),
  );
  check(await supabase.rpc('extend_series', { p_series: series.id }));
  const first: Row = check(
    await supabase.from('events').select(EVENT_SELECT).eq('series_id', series.id).order('date_time').limit(1).single(),
  );
  const event = toEvent(first);
  return input.poster ? setEventPoster(event, input.poster) : event;
}

// The regulars ("Ci sono ogni volta") of a series
export async function getSeriesRegulars(seriesId: string): Promise<SeriesRegular[]> {
  return check(await supabase.from('series_regulars').select('*').eq('series_id', seriesId)) as SeriesRegular[];
}

// "Ci sono ogni volta": your choices at this occurrence become the usual ones for the next ones
export async function setRegular(eventId: string): Promise<void> {
  check(await supabase.rpc('set_regular', { p_event: eventId }));
}

// "Non più ogni volta": your answers to the next occurrences go away
export async function removeRegular(eventId: string): Promise<void> {
  check(await supabase.rpc('remove_regular', { p_event: eventId }));
}

// Creator or admin: move the last day (later: new dates; earlier: the dates after it go away)
export async function setSeriesEnd(seriesId: string, lastDay: string): Promise<void> {
  check(await supabase.rpc('set_series_end', { p_series: seriesId, p_end: lastDay }));
}

// Creator or admin: no more occurrences. Past ones stay (with their points); future ones are deleted.
export async function stopSeries(seriesId: string): Promise<void> {
  check(await supabase.from('events').delete().eq('series_id', seriesId).gt('date_time', new Date().toISOString()));
  check(await supabase.from('event_series').delete().eq('id', seriesId));
}

// ---- "Per te" ----

// Counts from the database (never names): see lib/recommendations.ts
export async function getForYouSignals(): Promise<ForYouSignals> {
  return check(await supabase.rpc('for_you_signals')) as ForYouSignals;
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

// Organizer or admin: change title, date, place, topics, visibility (who's going gets a notification
// when date or place change)
export async function updateEvent(eventId: string, changes: EventChanges): Promise<EventWithGroup> {
  if (changes.title !== undefined && !changes.title.trim()) throw new Error('Dai un titolo all’evento');
  const row: Row = check(await supabase.from('events').update(changes).eq('id', eventId).select(EVENT_SELECT).single());
  return toEvent(row);
}

// Organizer or admin: "Annulla" (it stays visible as cancelled, people going get a notification), or undo it
export async function setEventCancelled(eventId: string, cancelled: boolean): Promise<void> {
  check(await supabase.from('events').update({ cancelled_at: cancelled ? new Date().toISOString() : null }).eq('id', eventId));
}

// Organizer or admin. Its photos are files in Storage: removed first (best effort).
export async function deleteEvent(eventId: string): Promise<void> {
  const photos = await getEventPhotos(eventId);
  if (photos.length) await supabase.storage.from('event-photos').remove(photos.map((p) => `${eventId}/${p.user_id}`));
  check(await supabase.from('events').delete().eq('id', eventId));
}

// Events (and holidays) you said "Ci sono" to, past and future: for your agenda and calendar
export async function getMyAgenda(userId: string): Promise<EventWithGroup[]> {
  await extendSeries();
  const rows: Row[] = check(
    await supabase.from('event_attendees').select(`events!inner(${EVENT_SELECT})`).eq('user_id', userId).eq('status', 'going'),
  );
  return rows.map((r) => toEvent(r.events)).sort((a, b) => a.date_time.localeCompare(b.date_time));
}

// ---- Holiday plan ("Cosa fare / cosa vedere"): every member and guest can edit it ----

export async function getTripItems(eventId: string): Promise<TripItem[]> {
  const rows: Row[] = check(
    await supabase
      .from('trip_items')
      .select('*, trip_item_votes(user_id)')
      .eq('event_id', eventId)
      .order('day', { nullsFirst: true })
      .order('created_at'),
  );
  return rows.map(({ trip_item_votes, ...item }) => ({ ...item, votes: trip_item_votes.map((v: Row) => v.user_id) }));
}

// Vote (or take the vote back) for a plan item
export async function voteTripItem(userId: string, itemId: string, vote: boolean): Promise<void> {
  if (vote) check(await supabase.from('trip_item_votes').insert({ item_id: itemId, user_id: userId }));
  else check(await supabase.from('trip_item_votes').delete().eq('item_id', itemId).eq('user_id', userId));
}

export async function addTripItem(userId: string, eventId: string, item: Pick<TripItem, 'title' | 'kind' | 'day'>): Promise<void> {
  if (!item.title.trim()) throw new Error('Scrivi cosa fare o cosa vedere');
  check(await supabase.from('trip_items').insert({ ...item, title: item.title.trim(), event_id: eventId, created_by: userId }));
}

export async function updateTripItem(itemId: string, changes: Partial<Pick<TripItem, 'title' | 'kind' | 'day' | 'done'>>): Promise<void> {
  if (changes.title !== undefined && !changes.title.trim()) throw new Error('Il testo non può essere vuoto');
  check(await supabase.from('trip_items').update(changes).eq('id', itemId));
}

export async function deleteTripItem(itemId: string): Promise<void> {
  check(await supabase.from('trip_items').delete().eq('id', itemId));
}

// ---- Event photos: one per person, seen by whoever sees the group ----

export async function getEventPhotos(eventId: string): Promise<EventPhoto[]> {
  return check(await supabase.from('event_photos').select('*').eq('event_id', eventId).order('created_at')) as EventPhoto[];
}

// Add or replace your photo (file = null removes it)
export async function setMyEventPhoto(userId: string, eventId: string, file: PickedFile | null): Promise<void> {
  if (!file) return removeEventPhoto(eventId, userId);
  const url = await uploadFile('event-photos', `${eventId}/${userId}`, file);
  check(await supabase.from('event_photos').upsert({ event_id: eventId, user_id: userId, url, created_at: new Date().toISOString() }));
}

// Yours, or anyone's if you're the group admin
export async function removeEventPhoto(eventId: string, userId: string): Promise<void> {
  check(await supabase.from('event_photos').delete().eq('event_id', eventId).eq('user_id', userId));
  await supabase.storage.from('event-photos').remove([`${eventId}/${userId}`]);
}

// ---- Shared expenses ("Spese", like Splitwise): see lib/expenses.ts for balances ----

export async function getExpenses(eventId: string): Promise<Expense[]> {
  const rows: Row[] = check(
    await supabase.from('expenses').select('*, expense_shares(user_id, amount_cents)').eq('event_id', eventId).order('created_at'),
  );
  return rows.map(({ expense_shares, ...expense }) => ({ ...expense, shares: expense_shares }));
}

// The database checks that the shares add up and that everyone is in the group, and notifies them
export async function addExpense(
  eventId: string,
  expense: { description: string; amount_cents: number; paid_by: string; shares: Expense['shares']; settlement?: boolean },
): Promise<void> {
  if (!expense.description.trim()) throw new Error('Scrivi per cosa è la spesa');
  check(
    await supabase.rpc('add_expense', {
      p_event: eventId,
      p_description: expense.description.trim(),
      p_amount_cents: expense.amount_cents,
      p_paid_by: expense.paid_by,
      p_shares: expense.shares,
      p_settlement: expense.settlement ?? false,
    }),
  );
}

// Whoever added or paid it, or the group admin
export async function deleteExpense(expenseId: string): Promise<void> {
  const { error, count } = await supabase.from('expenses').delete({ count: 'exact' }).eq('id', expenseId);
  if (error) throw toError(error);
  if (!count) throw new Error('Può toglierla solo chi l’ha aggiunta o pagata, o l’admin');
}

// ---- Points, reliability, venues ----

// Your points: earned (same rules as lib/points.ts, per account type) and spent (venues' promotions)
export async function getMyPoints(): Promise<{ earned: number; spent: number }> {
  return check(await supabase.rpc('my_points')) as { earned: number; spent: number };
}

// Points behind the reliability of people and groups (lib/reliability.ts): id -> points
export async function getReliability(
  userIds: string[],
  groupIds: string[],
): Promise<{ users: Record<string, number>; groups: Record<string, number> }> {
  if (!userIds.length && !groupIds.length) return { users: {}, groups: {} };
  return check(await supabase.rpc('reliability', { p_users: userIds, p_groups: groupIds })) as {
    users: Record<string, number>;
    groups: Record<string, number>;
  };
}

// Venue: send the event to the groups within radiusKm (costs points, once per event)
export async function promoteEvent(eventId: string, radiusKm: number): Promise<{ groups: number; people: number; spent: number }> {
  return check(await supabase.rpc('promote_event', { p_event: eventId, p_radius_km: radiusKm })) as {
    groups: number;
    people: number;
    spent: number;
  };
}

// Venue: whether this event was already promoted (once per event)
export async function wasPromoted(eventId: string): Promise<boolean> {
  const { count, error } = await supabase.from('point_spends').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
  if (error) throw toError(error);
  return Boolean(count);
}

// Weekly newsletter: at most once a week the database adds "La tua settimana" to Attività (best effort)
export async function sendNewsletterIfDue(): Promise<void> {
  await supabase.rpc('newsletter_digest');
}

// ---- Blocking, hiding, reporting ----

// The people you don't see (you blocked them, or they blocked you): their messages, their names in lists
export async function getHiddenUserIds(): Promise<Set<string>> {
  return new Set(check(await supabase.rpc('hidden_users')) as string[]);
}

// The people you blocked, to unblock them (Profilo -> Account)
export async function getBlockedUsers(userId: string): Promise<Pick<User, 'id' | 'full_name' | 'avatar_url' | 'avatar_seed'>[]> {
  const rows = check(await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)) as { blocked_id: string }[];
  if (!rows.length) return [];
  return check(
    await supabase.from('users').select('id, full_name, avatar_url, avatar_seed').in('id', rows.map((r) => r.blocked_id)),
  ) as Pick<User, 'id' | 'full_name' | 'avatar_url' | 'avatar_seed'>[];
}

export async function blockUser(userId: string, blockedId: string): Promise<void> {
  check(await supabase.from('user_blocks').upsert({ blocker_id: userId, blocked_id: blockedId }));
}

export async function unblockUser(userId: string, blockedId: string): Promise<void> {
  check(await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId));
}

// A hidden group disappears for you everywhere (lists, search, suggestions, events); not if you're in it
export async function hideGroup(userId: string, groupId: string): Promise<void> {
  check(await supabase.from('hidden_groups').upsert({ user_id: userId, group_id: groupId }));
}

export async function unhideGroup(userId: string, groupId: string): Promise<void> {
  check(await supabase.from('hidden_groups').delete().eq('user_id', userId).eq('group_id', groupId));
}

export async function getHiddenGroups(): Promise<HiddenGroup[]> {
  return check(await supabase.rpc('my_hidden_groups')) as HiddenGroup[];
}

// "Segnala": read by the app's owner, who can suspend the person or the group
export async function report(target: { userId: string } | { groupId: string }, reason: string): Promise<void> {
  const text = reason.trim();
  if (!text) throw new Error('Scrivi in breve cosa non va');
  check(
    await supabase.from('reports').insert({
      user_id: 'userId' in target ? target.userId : null,
      group_id: 'groupId' in target ? target.groupId : null,
      reason: text.slice(0, 500),
    }),
  );
}

// ---- A whole group joins an event ----

export async function getEventGroups(eventId: string): Promise<EventGroupSummary[]> {
  return check(await supabase.rpc('event_groups_summary', { eid: eventId })) as EventGroupSummary[];
}

// The group's admin: "Ci veniamo come gruppo" (every member is asked, and answers for themselves)
export async function joinEventAsGroup(eventId: string, groupId: string): Promise<void> {
  check(await supabase.rpc('join_event_as_group', { eid: eventId, gid: groupId }));
}

export async function leaveEventAsGroup(eventId: string, groupId: string): Promise<void> {
  check(await supabase.rpc('leave_event_as_group', { eid: eventId, gid: groupId }));
}

// ---- The group's history ----

export async function getGroupHistory(groupId: string): Promise<GroupHistory | null> {
  return check(await supabase.rpc('group_history', { gid: groupId })) as GroupHistory | null;
}

// Everyone who answered, "Ci sono" first (people on site first), then "Non ci sono"
export async function getEventAttendees(eventId: string): Promise<AttendeeWithProfile[]> {
  const rows: Row[] = check(
    // users!…user_id: the person who answered (ride_with is a second link to users, the driver)
    await supabase
      .from('event_attendees')
      .select('status, checked_in, transport, seats, depart_area, depart_time, ride_with, ride_status, users!event_attendees_user_id_fkey(*)')
      .eq('event_id', eventId),
  );
  return rows
    .filter((r) => r.users)
    .map(({ users, ...answer }) => ({ ...users, ...answer }))
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

// Driver: where and when you leave (an area like "Piazza Dante", never your position); null clears it
export async function setDeparture(userId: string, eventId: string, area: string | null, time: string | null): Promise<void> {
  check(
    await supabase
      .from('event_attendees')
      .update({ depart_area: area?.trim() || null, depart_time: time })
      .eq('event_id', eventId)
      .eq('user_id', userId),
  );
}

// Ask a driver for a ride (null = withdraw the request, or get out). The database checks the free
// seats and notifies the driver, who accepts or declines (answerRide).
export async function rideWith(userId: string, eventId: string, driverId: string | null): Promise<void> {
  check(
    await supabase
      .from('event_attendees')
      .upsert({ event_id: eventId, user_id: userId, status: 'going', transport: 'need_ride', ride_with: driverId }),
  );
}

// Driver: accept or decline a ride request (the passenger gets a notification)
export async function answerRide(eventId: string, passengerId: string, accept: boolean): Promise<void> {
  check(await supabase.rpc('answer_ride', { p_event: eventId, p_passenger: passengerId, p_accept: accept }));
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

// eventId: share an event or holiday (the database checks it can go in this chat)
export async function sendMessage(groupId: string, userId: string, content: string, eventId?: string): Promise<ChatMessageWithAuthor> {
  const text = content.trim();
  if (!text) throw new Error('Il messaggio è vuoto');
  const row: Row = check(
    await supabase
      .from('chat_messages')
      .insert({ group_id: groupId, user_id: userId, content: text, event_id: eventId ?? null })
      .select(AUTHOR_SELECT)
      .single(),
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
      // the realtime row has only ids: fetch the author (cached) and the shared event
      Promise.all([authors.get(row.user_id)!, row.event_id ? getEventById(row.event_id) : null]).then(([user, event]) =>
        onMessage({ ...toMessage({ ...row, users: user }), event }),
      );
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
