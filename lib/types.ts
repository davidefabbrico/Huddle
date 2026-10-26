// Data model types. They mirror the tables in supabase/schema.sql one-to-one,
// so the mock layer and the future Supabase layer return the same shapes.

export type UserRole = 'solo' | 'group';
export type UserIntent = 'friends' | 'group' | 'friends_and_dating';
export type GroupType = 'closed' | 'open_to_new';
export type MemberRole = 'admin' | 'member';
export type JoinStatus = 'pending' | 'guest' | 'accepted' | 'rejected';
export type NotificationType =
  | 'join_request' // to the admin: someone wants to join
  | 'request_accepted'
  | 'request_guest'
  | 'request_rejected'
  | 'new_event' // to members: a new event in their group
  | 'rank_up'; // to you: you reached a new rank in a group

// ---- Tables ----

export interface User {
  id: string;
  full_name: string;
  bio: string;
  is_relocated: boolean;
  relocated_at: string | null; // YYYY-MM-DD, roughly when they moved to the city
  interests: string[];
  role: UserRole;
  intent: UserIntent;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  admin_id: string;
  location: string;
  type: GroupType;
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  role: MemberRole;
}

export interface Event {
  id: string;
  group_id: string;
  title: string;
  date_time: string; // ISO 8601
  location: string;
}

// RSVP ("Ci sarò") and check-in ("Sono qui"). Check-ins drive the member ranks (lib/ranks.ts).
export interface EventAttendee {
  event_id: string;
  user_id: string;
  checked_in: boolean;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  group_id: string;
  status: JoinStatus;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string; // ISO 8601
}

// Unused in the MVP, kept for the schema
export interface Friendship {
  user_a: string;
  user_b: string;
  level: number;
  shared_points: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  group_id: string | null;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
}

// ---- Joined "view" shapes returned by the data layer ----

export interface GroupSummary extends Group {
  member_count: number;
  relocated_count: number; // members with is_relocated = true
}

export interface MemberWithProfile extends User {
  member_role: MemberRole;
}

export interface EventWithGroup extends Event {
  group_name: string;
}

export interface AttendeeWithProfile extends User {
  checked_in: boolean;
}

export interface ChatMessageWithAuthor extends ChatMessage {
  author: Pick<User, 'id' | 'full_name' | 'is_relocated'>;
}

export interface JoinRequestWithUser extends JoinRequest {
  user: User;
}

// A group the user belongs to, with what drives their rank there
export interface Membership {
  group: Group;
  member_role: MemberRole;
  attended_events: number; // events of this group with checked_in = true
}

// A chat the user can open, for the chat list
export interface ChatPreview {
  group: Group;
  access: 'member' | 'guest' | 'accepted';
  last_message: ChatMessageWithAuthor | null;
}

// A group you administer, with requests waiting for you
export interface AdminGroup {
  group: Group;
  pending_requests: number;
}

// Everything the profile needs for ranks and achievements
export interface ProfileStats {
  memberships: Membership[];
  checked_in_events: Event[];
  message_count: number;
}

// ---- Inputs ----

// Data collected by the signup/onboarding screen
export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  intent: UserIntent;
  is_relocated: boolean;
  relocated_at?: string | null;
  bio?: string;
  interests?: string[];
}

export interface NewGroupInput {
  name: string;
  description: string;
  location: string;
  type: GroupType;
}

export interface NewEventInput {
  group_id: string;
  title: string;
  date_time: string;
  location: string;
}
