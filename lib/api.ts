// Data-access layer. Screens and hooks import ONLY from this file.
// Today it reads/writes an in-memory copy of lib/mockData.ts (reset on reload).
// To switch to Supabase, re-implement each function with the query shown in
// its comment (client in lib/supabase.ts); signatures stay the same.
// Notifications are created here by hand; in Supabase the triggers in schema.sql do it.

import { validateChatLink } from './chatLinks';
import { eventPhase } from './eventTiming';
import { randomSeed } from './identicon';
import * as mock from './mockData';
import { rankFor, type Rank } from './ranks';
import type {
  AdminGroup,
  AttendeeWithProfile,
  ChatMessage,
  ChatMessageWithAuthor,
  ChatPreview,
  Event,
  EventAttendee,
  EventWithGroup,
  Group,
  GroupSummary,
  JoinRequest,
  JoinRequestWithUser,
  JoinStatus,
  Membership,
  MemberWithProfile,
  NewEventInput,
  NewGroupInput,
  Notification,
  PickedFile,
  ProfileStats,
  SignUpInput,
  User,
} from './types';

// ---- In-memory "database" (cloned so the mock constants stay untouched) ----

const db = {
  users: mock.users.map((u) => ({ ...u, interests: [...u.interests] })),
  groups: mock.groups.map((g) => ({ ...g })),
  groupMembers: mock.groupMembers.map((m) => ({ ...m })),
  events: mock.events.map((e) => ({ ...e })),
  eventAttendees: mock.eventAttendees.map((a) => ({ ...a })),
  joinRequests: mock.joinRequests.map((r) => ({ ...r })),
  chatMessages: mock.chatMessages.map((m) => ({ ...m })),
  notifications: mock.notifications.map((n) => ({ ...n })),
  groupLinks: mock.groupLinks.map((l) => ({ ...l })),
  accounts: { ...mock.mockAccounts },
};

let currentUserId: string | null = null;

// Simulated network latency, so loading states are visible in the UI
const delay = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const isMember = (userId: string, groupId: string) =>
  db.groupMembers.some((m) => m.user_id === userId && m.group_id === groupId);

// Same rule as can_access_chat() in SQL: members, guests and accepted requesters
function hasGroupAccess(userId: string, groupId: string): boolean {
  const request = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  return isMember(userId, groupId) || request?.status === 'guest' || request?.status === 'accepted';
}

// Check-ins of a user at a group's events (drives the rank)
function attendedInGroup(userId: string, groupId: string): number {
  const groupEventIds = new Set(db.events.filter((e) => e.group_id === groupId).map((e) => e.id));
  return db.eventAttendees.filter((a) => a.user_id === userId && a.checked_in && groupEventIds.has(a.event_id)).length;
}

const groupName = (groupId: string) => db.groups.find((g) => g.id === groupId)?.name ?? '';
const userName = (userId: string) => db.users.find((u) => u.id === userId)?.full_name ?? 'Qualcuno';

function withGroupName(event: Event): EventWithGroup {
  return { ...event, group_name: groupName(event.group_id) };
}

function withAuthor(message: ChatMessage): ChatMessageWithAuthor {
  const user = db.users.find((u) => u.id === message.user_id);
  return {
    ...message,
    author: {
      id: message.user_id,
      full_name: user?.full_name ?? 'Utente',
      is_relocated: user?.is_relocated ?? false,
      avatar_url: user?.avatar_url ?? null,
      avatar_seed: user?.avatar_seed ?? null,
    },
  };
}

// Stores a picked file and returns its URL.
// MOCK: keeps the local URI (blob: on web, file:// on the phone), valid until the app reloads.
// Supabase: supabase.storage.from(bucket).upload(path, file, { contentType: file.mimeType, upsert: true })
// then supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
// (on web upload the asset's `file`; on native fetch(uri) -> blob/arrayBuffer first).
async function uploadFile(_bucket: 'avatars' | 'event-posters', _path: string, file: PickedFile): Promise<string> {
  await delay(400);
  return file.uri;
}

function notify(n: Omit<Notification, 'id' | 'read_at' | 'created_at'>) {
  db.notifications.push({ ...n, id: newId('n'), read_at: null, created_at: new Date().toISOString() });
}

// ---- Auth ----

// supabase.auth.signInWithPassword({ email, password }), then getUserById(session.user.id)
export async function signIn(email: string, _password: string): Promise<User> {
  await delay();
  const userId = db.accounts[email.trim().toLowerCase()];
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('Email o password non validi');
  currentUserId = user.id;
  return { ...user };
}

// supabase.auth.signUp({ email, password, options: { data: { full_name, role, intent, is_relocated, relocated_at } } })
// The handle_new_user trigger in schema.sql creates the public.users row.
export async function signUp(input: SignUpInput): Promise<User> {
  await delay();
  const email = input.email.trim().toLowerCase();
  if (db.accounts[email]) throw new Error('Esiste già un account con questa email');
  const user: User = {
    id: newId('u'),
    full_name: input.full_name.trim(),
    bio: input.bio ?? '',
    is_relocated: input.is_relocated,
    relocated_at: input.is_relocated ? (input.relocated_at ?? null) : null,
    interests: input.interests ?? [],
    avatar_url: null,
    avatar_seed: randomSeed(), // pixel avatar by default, like GitHub
    role: input.role,
    intent: input.intent,
  };
  db.users.push(user);
  db.accounts[email] = user.id;
  currentUserId = user.id;
  return { ...user };
}

// supabase.auth.signOut()
export async function signOut(): Promise<void> {
  await delay(100);
  currentUserId = null;
}

// supabase.auth.getSession(), then getUserById(session.user.id)
export async function getCurrentUser(): Promise<User | null> {
  await delay(100);
  const user = db.users.find((u) => u.id === currentUserId);
  return user ? { ...user } : null;
}

// supabase.from('users').update(changes).eq('id', userId).select().single()
export async function updateProfile(userId: string, changes: Partial<Omit<User, 'id'>>): Promise<User> {
  await delay();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('Utente non trovato');
  if (changes.full_name !== undefined && !changes.full_name.trim()) throw new Error('Il nome non può essere vuoto');
  Object.assign(user, changes);
  if (!user.is_relocated) user.relocated_at = null;
  return { ...user, interests: [...user.interests] };
}

// Profile photo. Supabase: uploadFile('avatars', `${userId}/avatar`, file), then updateProfile({ avatar_url })
export async function uploadAvatar(userId: string, file: PickedFile): Promise<string> {
  return uploadFile('avatars', `${userId}/avatar`, file);
}

// ---- Users ----

// supabase.from('users').select('*').eq('id', userId).maybeSingle()
export async function getUserById(userId: string): Promise<User | null> {
  await delay(100);
  const user = db.users.find((u) => u.id === userId);
  return user ? { ...user } : null;
}

// ---- Groups ----

// supabase.from('groups').select('*, group_members(user_id, users(is_relocated))')
// then map to member_count / relocated_count
export async function getGroups(): Promise<GroupSummary[]> {
  await delay();
  return db.groups.map((group) => {
    const memberIds = db.groupMembers.filter((m) => m.group_id === group.id).map((m) => m.user_id);
    const relocated = db.users.filter((u) => memberIds.includes(u.id) && u.is_relocated);
    return { ...group, member_count: memberIds.length, relocated_count: relocated.length };
  });
}

// supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
export async function getGroupById(groupId: string): Promise<Group | null> {
  await delay(150);
  const group = db.groups.find((g) => g.id === groupId);
  return group ? { ...group } : null;
}

// supabase.from('group_members').select('role, users(*)').eq('group_id', groupId)
export async function getGroupMembers(groupId: string): Promise<MemberWithProfile[]> {
  await delay(150);
  return db.groupMembers
    .filter((m) => m.group_id === groupId)
    .map((m) => {
      const user = db.users.find((u) => u.id === m.user_id)!;
      return { ...user, member_role: m.role };
    })
    // Admin first, then alphabetical
    .sort((a, b) => (a.member_role === b.member_role ? a.full_name.localeCompare(b.full_name) : a.member_role === 'admin' ? -1 : 1));
}

// supabase.from('groups').insert({ ...input, admin_id: userId }).select().single()
// The on_group_created trigger adds the creator as admin member.
export async function createGroup(userId: string, input: NewGroupInput): Promise<Group> {
  await delay();
  if (!input.name.trim()) throw new Error('Dai un nome al gruppo');
  const linkError = validateChatLink(input.chat_url ?? '');
  if (linkError) throw new Error(linkError);
  const group: Group = {
    id: newId('g'),
    name: input.name.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    type: input.type,
    admin_id: userId,
  };
  db.groups.push(group);
  db.groupMembers.push({ user_id: userId, group_id: group.id, role: 'admin' });
  if (input.chat_url?.trim()) db.groupLinks.push({ group_id: group.id, chat_url: input.chat_url.trim() });
  return { ...group };
}

// Admin only. supabase.from('groups').update(changes).eq('id', groupId), and for the chat link
// supabase.from('group_links').upsert({ group_id, chat_url }) or .delete().eq('group_id', groupId)
export async function updateGroup(userId: string, groupId: string, changes: Partial<NewGroupInput>): Promise<Group> {
  await delay();
  const group = db.groups.find((g) => g.id === groupId);
  if (!group || group.admin_id !== userId) throw new Error('Solo l’admin può modificare il gruppo');
  if (changes.name !== undefined && !changes.name.trim()) throw new Error('Dai un nome al gruppo');
  const { chat_url, ...fields } = changes;
  if (chat_url !== undefined) {
    const linkError = validateChatLink(chat_url ?? '');
    if (linkError) throw new Error(linkError);
    db.groupLinks = db.groupLinks.filter((l) => l.group_id !== groupId);
    if (chat_url?.trim()) db.groupLinks.push({ group_id: groupId, chat_url: chat_url.trim() });
  }
  Object.assign(group, fields);
  return { ...group };
}

// The external chat link, only for members and guests (RLS on group_links does the same).
// supabase.from('group_links').select('chat_url').eq('group_id', groupId).maybeSingle()
export async function getGroupChatLink(userId: string, groupId: string): Promise<string | null> {
  await delay(100);
  if (!hasGroupAccess(userId, groupId)) return null;
  return db.groupLinks.find((l) => l.group_id === groupId)?.chat_url ?? null;
}

// Groups the user belongs to, with check-ins at that group's events (drives the rank).
// Supabase: supabase.from('group_members').select('role, groups(*)').eq('user_id', userId)
// plus supabase.from('event_attendees').select('events!inner(group_id)').eq('user_id', userId).eq('checked_in', true)
// and count the check-ins per group_id.
export async function getMemberships(userId: string): Promise<Membership[]> {
  await delay();
  return membershipsOf(userId);
}

function membershipsOf(userId: string): Membership[] {
  return db.groupMembers
    .filter((m) => m.user_id === userId)
    .map((m) => {
      const group = db.groups.find((g) => g.id === m.group_id)!;
      return { group: { ...group }, member_role: m.role, attended_events: attendedInGroup(userId, group.id) };
    })
    .sort((a, b) => b.attended_events - a.attended_events);
}

// Groups you administer, with pending requests.
// supabase.from('groups').select('*, join_requests(count)').eq('admin_id', userId).eq('join_requests.status', 'pending')
export async function getAdminGroups(userId: string): Promise<AdminGroup[]> {
  await delay();
  return db.groups
    .filter((g) => g.admin_id === userId)
    .map((group) => ({
      group: { ...group },
      pending_requests: db.joinRequests.filter((r) => r.group_id === group.id && r.status === 'pending').length,
    }));
}

// ---- Profile ----

// Data for ranks and achievements. Supabase: getMemberships + check-ins joined with events
// + supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId)
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  await delay();
  const checkedInIds = new Set(db.eventAttendees.filter((a) => a.user_id === userId && a.checked_in).map((a) => a.event_id));
  return {
    memberships: membershipsOf(userId),
    checked_in_events: db.events.filter((e) => checkedInIds.has(e.id)).map((e) => ({ ...e })),
    message_count: db.chatMessages.filter((m) => m.user_id === userId).length,
  };
}

// ---- Events ----

// Upcoming and live events (live = started less than 6 hours ago, see lib/eventTiming.ts).
// supabase.from('events').select('*, groups(name)').gte('date_time', sixHoursAgo).order('date_time').limit(limit)
export async function getUpcomingEvents(limit = 20): Promise<EventWithGroup[]> {
  await delay();
  return db.events
    .filter((e) => eventPhase(e.date_time) !== 'ended')
    .sort((a, b) => a.date_time.localeCompare(b.date_time))
    .slice(0, limit)
    .map(withGroupName);
}

// Same as above with .eq('group_id', groupId)
export async function getGroupEvents(groupId: string): Promise<EventWithGroup[]> {
  const upcoming = await getUpcomingEvents(Number.MAX_SAFE_INTEGER);
  return upcoming.filter((e) => e.group_id === groupId);
}

// supabase.from('events').select('*, groups(name)').eq('id', eventId).maybeSingle()
export async function getEventById(eventId: string): Promise<EventWithGroup | null> {
  await delay(150);
  const event = db.events.find((e) => e.id === eventId);
  return event ? withGroupName(event) : null;
}

// Admin only. supabase.from('events').insert(input).select('*, groups(name)').single()
// The on_event_created trigger notifies the group's members.
export async function createEvent(userId: string, input: NewEventInput): Promise<EventWithGroup> {
  await delay();
  const group = db.groups.find((g) => g.id === input.group_id);
  if (!group || group.admin_id !== userId) throw new Error('Solo l’admin del gruppo può creare eventi');
  if (!input.title.trim()) throw new Error('Dai un titolo all’evento');
  const id = newId('e');
  const event: Event = {
    id,
    group_id: group.id,
    title: input.title.trim(),
    date_time: input.date_time,
    location: input.location.trim(),
    poster_url: input.poster ? await uploadFile('event-posters', `${group.id}/${id}`, input.poster) : null,
    poster_mime: input.poster?.mimeType ?? null,
  };
  db.events.push(event);
  for (const m of db.groupMembers.filter((m) => m.group_id === group.id && m.user_id !== userId)) {
    notify({ user_id: m.user_id, type: 'new_event', title: 'Nuovo evento', body: `${group.name}: ${event.title}`, group_id: group.id, event_id: event.id });
  }
  return withGroupName(event);
}

// Admin only: add, replace or remove (file = null) the event poster.
// Supabase: uploadFile('event-posters', `${groupId}/${eventId}`, file), then
// supabase.from('events').update({ poster_url, poster_mime }).eq('id', eventId)
export async function setEventPoster(userId: string, eventId: string, file: PickedFile | null): Promise<EventWithGroup> {
  await delay();
  const event = db.events.find((e) => e.id === eventId);
  const group = event && db.groups.find((g) => g.id === event.group_id);
  if (!event || !group || group.admin_id !== userId) throw new Error('Solo l’admin può cambiare la locandina');
  event.poster_url = file ? await uploadFile('event-posters', `${group.id}/${event.id}`, file) : null;
  event.poster_mime = file?.mimeType ?? null;
  return withGroupName(event);
}

// Who's coming (RSVP) and who checked in.
// supabase.from('event_attendees').select('checked_in, users(*)').eq('event_id', eventId)
export async function getEventAttendees(eventId: string): Promise<AttendeeWithProfile[]> {
  await delay(150);
  return db.eventAttendees
    .filter((a) => a.event_id === eventId)
    .map((a) => ({ ...db.users.find((u) => u.id === a.user_id)!, checked_in: a.checked_in }))
    .sort((a, b) => Number(b.checked_in) - Number(a.checked_in) || a.full_name.localeCompare(b.full_name));
}

// supabase.from('event_attendees').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle()
export async function getAttendance(userId: string, eventId: string): Promise<EventAttendee | null> {
  await delay(100);
  const row = db.eventAttendees.find((a) => a.event_id === eventId && a.user_id === userId);
  return row ? { ...row } : null;
}

// RSVP "Ci sarò" (attending = true) or cancel it.
// supabase.from('event_attendees').upsert({ event_id, user_id }) / .delete().eq(...)
export async function setAttending(userId: string, eventId: string, attending: boolean): Promise<void> {
  await delay();
  const event = db.events.find((e) => e.id === eventId);
  if (!event || !hasGroupAccess(userId, event.group_id)) throw new Error('Entra nel gruppo per partecipare');
  const index = db.eventAttendees.findIndex((a) => a.event_id === eventId && a.user_id === userId);
  if (attending && index === -1) db.eventAttendees.push({ event_id: eventId, user_id: userId, checked_in: false });
  // A check-in can't be undone
  if (!attending && index !== -1 && !db.eventAttendees[index].checked_in) db.eventAttendees.splice(index, 1);
}

// "Sono qui": check-in while the event is live. Returns the new rank if you climbed one.
// supabase.from('event_attendees').upsert({ event_id, user_id, checked_in: true })
// (RLS only accepts it inside the check-in window; the on_check_in trigger sends the rank_up notification)
export async function checkIn(userId: string, eventId: string): Promise<{ attended: number; newRank: Rank | null }> {
  await delay();
  const event = db.events.find((e) => e.id === eventId);
  if (!event || !hasGroupAccess(userId, event.group_id)) throw new Error('Entra nel gruppo per partecipare');
  if (eventPhase(event.date_time) !== 'live') throw new Error('Il check-in è aperto solo durante l’evento');

  const before = attendedInGroup(userId, event.group_id);
  const row = db.eventAttendees.find((a) => a.event_id === eventId && a.user_id === userId);
  if (row) row.checked_in = true;
  else db.eventAttendees.push({ event_id: eventId, user_id: userId, checked_in: true });
  const after = attendedInGroup(userId, event.group_id);

  const newRank = rankFor(after).level > rankFor(before).level ? rankFor(after) : null;
  if (newRank) {
    notify({ user_id: userId, type: 'rank_up', title: `Nuovo grado: ${newRank.name} ${newRank.emoji}`, body: groupName(event.group_id), group_id: event.group_id, event_id: null });
  }
  return { attended: after, newRank };
}

// ---- Join requests ----

// supabase.from('join_requests').select('*').eq('user_id', userId).eq('group_id', groupId).maybeSingle()
export async function getJoinRequest(userId: string, groupId: string): Promise<JoinRequest | null> {
  await delay(100);
  const request = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  return request ? { ...request } : null;
}

// supabase.from('join_requests').insert({ user_id: userId, group_id: groupId }).select().single()
// (RLS only allows status 'pending' and groups of type 'open_to_new'; on_join_request_created notifies the admin)
export async function requestToJoin(userId: string, groupId: string): Promise<JoinRequest> {
  await delay();
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  if (group.type === 'closed') throw new Error('Questo gruppo al momento non accetta nuovi membri');
  if (isMember(userId, groupId)) throw new Error('Fai già parte di questo gruppo');
  const existing = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  if (existing) {
    // A rejected user may ask again; otherwise keep the current request
    if (existing.status === 'rejected') existing.status = 'pending';
    return { ...existing };
  }
  const request: JoinRequest = { id: newId('jr'), user_id: userId, group_id: groupId, status: 'pending' };
  db.joinRequests.push(request);
  notify({ user_id: group.admin_id, type: 'join_request', title: 'Nuova richiesta', body: `${userName(userId)} vuole entrare in ${group.name}`, group_id: groupId, event_id: null });
  return { ...request };
}

// Requests an admin still has to handle (pending first, then guests).
// supabase.from('join_requests').select('*, users(*)').eq('group_id', groupId).in('status', ['pending', 'guest'])
export async function getGroupJoinRequests(groupId: string): Promise<JoinRequestWithUser[]> {
  await delay(150);
  return db.joinRequests
    .filter((r) => r.group_id === groupId && (r.status === 'pending' || r.status === 'guest'))
    .map((r) => ({ ...r, user: { ...db.users.find((u) => u.id === r.user_id)! } }))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));
}

const statusNotification: Partial<Record<JoinStatus, { type: Notification['type']; title: string; body: (group: string) => string }>> = {
  accepted: { type: 'request_accepted', title: 'Richiesta accettata 🎉', body: (g) => `Ora fai parte di ${g}. Presentati in chat!` },
  guest: { type: 'request_guest', title: 'Sei ospite', body: (g) => `Puoi entrare nella lobby di ${g} e andare a un evento.` },
  rejected: { type: 'request_rejected', title: 'Richiesta non accettata', body: (g) => `${g} al momento non può accoglierti.` },
};

// Admin action. supabase.from('join_requests').update({ status }).eq('id', requestId).select().single()
// The on_join_request_updated trigger adds the member on 'accepted' and notifies the requester.
export async function updateJoinRequestStatus(requestId: string, status: JoinStatus): Promise<JoinRequest> {
  await delay();
  const request = db.joinRequests.find((r) => r.id === requestId);
  if (!request) throw new Error('Richiesta non trovata');
  const changed = request.status !== status;
  request.status = status;
  if (status === 'accepted' && !isMember(request.user_id, request.group_id)) {
    db.groupMembers.push({ user_id: request.user_id, group_id: request.group_id, role: 'member' });
  }
  const message = statusNotification[status];
  if (changed && message) {
    const name = groupName(request.group_id);
    notify({ user_id: request.user_id, type: message.type, title: message.title, body: message.body(name), group_id: request.group_id, event_id: null });
  }
  return { ...request };
}

// Guests, accepted requesters and members may enter the lobby/chat.
// Mirrors the can_access_chat() SQL function used by RLS.
export async function canAccessChat(userId: string, groupId: string): Promise<boolean> {
  await delay(100);
  return hasGroupAccess(userId, groupId);
}

// ---- Notifications (Attività) ----

// supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
export async function getNotifications(userId: string): Promise<Notification[]> {
  await delay();
  return db.notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((n) => ({ ...n }));
}

// supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null)
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  await delay(100);
  return db.notifications.filter((n) => n.user_id === userId && !n.read_at).length;
}

// supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
export async function markNotificationsRead(userId: string): Promise<void> {
  await delay(100);
  const now = new Date().toISOString();
  db.notifications.filter((n) => n.user_id === userId && !n.read_at).forEach((n) => (n.read_at = now));
}

// ---- Chat ----

type MessageListener = (message: ChatMessageWithAuthor) => void;
const listeners = new Map<string, Set<MessageListener>>(); // group_id -> listeners

// supabase.from('chat_messages').select('*, users(id, full_name, is_relocated)')
//   .eq('group_id', groupId).order('created_at')
export async function getMessages(groupId: string): Promise<ChatMessageWithAuthor[]> {
  await delay();
  return db.chatMessages
    .filter((m) => m.group_id === groupId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(withAuthor);
}

// Chats the user can open (member, guest or accepted), most recent activity first.
// Supabase: memberships + join_requests with status guest/accepted, then the latest
// chat_messages row per group (e.g. a SQL view or an RPC function).
export async function getMyChats(userId: string): Promise<ChatPreview[]> {
  await delay();
  const previews: ChatPreview[] = [];
  for (const group of db.groups) {
    const request = db.joinRequests.find((r) => r.user_id === userId && r.group_id === group.id);
    const access = isMember(userId, group.id)
      ? 'member'
      : request?.status === 'guest' || request?.status === 'accepted'
        ? request.status
        : null;
    if (!access) continue;
    const last = db.chatMessages
      .filter((m) => m.group_id === group.id)
      .reduce<ChatMessage | null>((latest, m) => (!latest || m.created_at > latest.created_at ? m : latest), null);
    previews.push({ group: { ...group }, access, last_message: last ? withAuthor(last) : null });
  }
  return previews.sort((a, b) => (b.last_message?.created_at ?? '').localeCompare(a.last_message?.created_at ?? ''));
}

// supabase.from('chat_messages').insert({ group_id, user_id, content }).select().single()
export async function sendMessage(groupId: string, userId: string, content: string): Promise<ChatMessageWithAuthor> {
  await delay(150);
  const text = content.trim();
  if (!text) throw new Error('Il messaggio è vuoto');
  const message: ChatMessage = {
    id: newId('m'),
    group_id: groupId,
    user_id: userId,
    content: text,
    created_at: new Date().toISOString(),
  };
  return publish(message);
}

function publish(message: ChatMessage): ChatMessageWithAuthor {
  db.chatMessages.push(message);
  const full = withAuthor(message);
  listeners.get(message.group_id)?.forEach((listener) => listener(full));
  simulateWelcomeReply(message);
  return full;
}

// MOCK ONLY: the group admin answers someone's first message, so the chat feels alive.
// Delete this when using Supabase (real people reply).
const welcomed = new Set<string>(); // `${group_id}:${user_id}`
function simulateWelcomeReply(message: ChatMessage) {
  const group = db.groups.find((g) => g.id === message.group_id);
  const key = `${message.group_id}:${message.user_id}`;
  if (!group || group.admin_id === message.user_id || welcomed.has(key)) return;
  welcomed.add(key);
  const author = db.users.find((u) => u.id === message.user_id);
  const name = author?.full_name.split(' ')[0] ?? '';
  setTimeout(() => {
    publish({
      id: newId('m'),
      group_id: group.id,
      user_id: group.admin_id,
      content: `Ciao ${name}, che bello averti qui! 👋 Ci vediamo al prossimo evento?`,
      created_at: new Date().toISOString(),
    });
  }, 1800);
}

// Realtime: calls onMessage for every new message in the group. Returns an unsubscribe function.
// Supabase: supabase.channel(`chat:${groupId}`).on('postgres_changes',
//   { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
//   (payload) => ...fetch author, then onMessage(...)).subscribe()
// and return () => supabase.removeChannel(channel)
export function subscribeToMessages(groupId: string, onMessage: MessageListener): () => void {
  if (!listeners.has(groupId)) listeners.set(groupId, new Set());
  listeners.get(groupId)!.add(onMessage);
  return () => {
    listeners.get(groupId)?.delete(onMessage);
  };
}
