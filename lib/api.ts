// Data-access layer. Screens and hooks import ONLY from this file.
// Today it reads/writes an in-memory copy of lib/mockData.ts (reset on reload).
// To switch to Supabase, re-implement each function with the query shown in
// its comment (client in lib/supabase.ts); signatures stay the same.

import * as mock from './mockData';
import type {
  ChatMessage,
  ChatMessageWithAuthor,
  EventWithGroup,
  Group,
  GroupSummary,
  JoinRequest,
  JoinStatus,
  MemberWithProfile,
  SignUpInput,
  User,
} from './types';

// ---- In-memory "database" (cloned so the mock constants stay untouched) ----

const db = {
  users: mock.users.map((u) => ({ ...u, interests: [...u.interests] })),
  groups: mock.groups.map((g) => ({ ...g })),
  groupMembers: mock.groupMembers.map((m) => ({ ...m })),
  events: mock.events.map((e) => ({ ...e })),
  joinRequests: mock.joinRequests.map((r) => ({ ...r })),
  chatMessages: mock.chatMessages.map((m) => ({ ...m })),
  accounts: { ...mock.mockAccounts },
};

let currentUserId: string | null = null;

// Simulated network latency, so loading states are visible in the UI
const delay = (ms = 250) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function withAuthor(message: ChatMessage): ChatMessageWithAuthor {
  const user = db.users.find((u) => u.id === message.user_id);
  return {
    ...message,
    author: {
      id: message.user_id,
      full_name: user?.full_name ?? 'Utente',
      is_relocated: user?.is_relocated ?? false,
    },
  };
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

// supabase.auth.signUp({ email, password, options: { data: { full_name, role, intent, is_relocated } } })
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
    interests: input.interests ?? [],
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
  Object.assign(user, changes);
  return { ...user };
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

// ---- Events ----

// supabase.from('events').select('*, groups(name)').gte('date_time', new Date().toISOString())
//   .order('date_time').limit(limit)
export async function getUpcomingEvents(limit = 20): Promise<EventWithGroup[]> {
  await delay();
  const now = Date.now();
  return db.events
    .filter((e) => new Date(e.date_time).getTime() >= now)
    .sort((a, b) => a.date_time.localeCompare(b.date_time))
    .slice(0, limit)
    .map((e) => ({ ...e, group_name: db.groups.find((g) => g.id === e.group_id)?.name ?? '' }));
}

// Same as above with .eq('group_id', groupId)
export async function getGroupEvents(groupId: string): Promise<EventWithGroup[]> {
  const upcoming = await getUpcomingEvents(Number.MAX_SAFE_INTEGER);
  return upcoming.filter((e) => e.group_id === groupId);
}

// ---- Join requests ----

// supabase.from('join_requests').select('*').eq('user_id', userId).eq('group_id', groupId).maybeSingle()
export async function getJoinRequest(userId: string, groupId: string): Promise<JoinRequest | null> {
  await delay(100);
  const request = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  return request ? { ...request } : null;
}

// supabase.from('join_requests').insert({ user_id: userId, group_id: groupId }).select().single()
// (RLS only allows status 'pending' and groups of type 'open_to_new')
export async function requestToJoin(userId: string, groupId: string): Promise<JoinRequest> {
  await delay();
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new Error('Gruppo non trovato');
  if (group.type === 'closed') throw new Error('Questo gruppo al momento non accetta nuovi membri');
  if (db.groupMembers.some((m) => m.user_id === userId && m.group_id === groupId)) {
    throw new Error('Fai già parte di questo gruppo');
  }
  const existing = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  if (existing) {
    // A rejected user may ask again; otherwise keep the current request
    if (existing.status === 'rejected') existing.status = 'pending';
    return { ...existing };
  }
  const request: JoinRequest = { id: newId('jr'), user_id: userId, group_id: groupId, status: 'pending' };
  db.joinRequests.push(request);
  return { ...request };
}

// Admin action. supabase.from('join_requests').update({ status }).eq('id', requestId).select().single()
// When status becomes 'accepted', the on_join_request_accepted trigger adds the group member.
export async function updateJoinRequestStatus(requestId: string, status: JoinStatus): Promise<JoinRequest> {
  await delay();
  const request = db.joinRequests.find((r) => r.id === requestId);
  if (!request) throw new Error('Richiesta non trovata');
  request.status = status;
  const alreadyMember = db.groupMembers.some((m) => m.user_id === request.user_id && m.group_id === request.group_id);
  if (status === 'accepted' && !alreadyMember) {
    db.groupMembers.push({ user_id: request.user_id, group_id: request.group_id, role: 'member' });
  }
  return { ...request };
}

// Guests, accepted requesters and members may enter the lobby/chat.
// Mirrors the can_access_chat() SQL function used by RLS.
export async function canAccessChat(userId: string, groupId: string): Promise<boolean> {
  await delay(100);
  const isMember = db.groupMembers.some((m) => m.user_id === userId && m.group_id === groupId);
  const request = db.joinRequests.find((r) => r.user_id === userId && r.group_id === groupId);
  return isMember || request?.status === 'guest' || request?.status === 'accepted';
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
