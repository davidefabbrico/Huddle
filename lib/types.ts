// Data model types. They mirror the tables in supabase/schema.sql one-to-one,
// so the mock layer and the future Supabase layer return the same shapes.

export type UserRole = 'solo' | 'group';
export type UserIntent = 'friends' | 'group' | 'friends_and_dating';
export type GroupType = 'closed' | 'open_to_new';
export type MemberRole = 'admin' | 'member';
export type JoinStatus = 'pending' | 'guest' | 'accepted' | 'rejected';

// ---- Tables ----

export interface User {
  id: string;
  full_name: string;
  bio: string;
  is_relocated: boolean;
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

// Unused in the MVP, kept for the schema
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

export interface ChatMessageWithAuthor extends ChatMessage {
  author: Pick<User, 'id' | 'full_name' | 'is_relocated'>;
}

// Data collected by the signup/onboarding screen
export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  intent: UserIntent;
  is_relocated: boolean;
  bio?: string;
  interests?: string[];
}
