// Data model types. They mirror the tables in supabase/schema.sql
// (lib/api.ts maps the Supabase rows to these shapes).

export type UserRole = 'solo' | 'group';
export type UserIntent = 'friends' | 'group' | 'friends_and_dating';
export type GroupType = 'closed' | 'open_to_new';
export type MemberRole = 'admin' | 'member';
export type JoinStatus = 'pending' | 'guest' | 'accepted' | 'rejected';
export type RsvpStatus = 'going' | 'not_going'; // "Ci sono" / "Non ci sono"
export type Transport = 'car' | 'need_ride' | 'own'; // "In auto" / "Mi serve un passaggio" / "Per conto mio"
export type NotificationType =
  | 'join_request' // to the admin: someone wants to join
  | 'request_accepted'
  | 'request_guest'
  | 'request_rejected'
  | 'new_event' // to members: a new event in their group
  | 'rank_up' // to you: you reached a new rank in a group
  | 'thanks' // to you: someone thanked you for an event
  | 'ride'; // to you (driver): someone is coming in your car

// ---- Tables ----

export interface User {
  id: string;
  full_name: string;
  bio: string;
  is_relocated: boolean;
  relocated_at: string | null; // YYYY-MM-DD, roughly when they moved to the city
  interests: string[];
  // Avatar: a photo if avatar_url is set, else a pixel identicon if avatar_seed is set, else initials
  avatar_url: string | null;
  avatar_seed: string | null;
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
  created_by: string | null; // the organizer
  title: string;
  date_time: string; // ISO 8601
  location: string;
  lat: number | null; // coordinates of the place, for "Trova parcheggio" (SmartPark)
  lon: number | null;
  // Optional poster ("locandina"): a PDF or an image
  poster_url: string | null;
  poster_mime: string | null;
}

// Private links of a group, readable only by members and guests (separate table)
export interface GroupLinks {
  chat_url: string | null; // WhatsApp, Telegram…
  parking_code: string | null; // SmartPark group code: shared parking among the friends
}

// Where a driver left the car: shared with their passengers only, until 12 hours after the event
export interface CarSpot {
  event_id: string;
  user_id: string;
  lat: number;
  lon: number;
}

// Answer ("Ci sono" / "Non ci sono") and check-in ("Sono qui").
// Attended = checked in, or "Ci sono" for an event that has started: drives ranks and points.
export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  checked_in: boolean;
  transport: Transport | null;
  seats: number; // free seats offered by a driver
  ride_with: string | null; // the driver a passenger travels with
}

// A "grazie" sent to the organizer or to someone who came to an event
export interface Thanks {
  id: string;
  event_id: string;
  from_user: string;
  to_user: string;
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
  status: RsvpStatus;
  checked_in: boolean;
  transport: Transport | null;
  seats: number;
  ride_with: string | null;
}

export interface ChatMessageWithAuthor extends ChatMessage {
  author: Pick<User, 'id' | 'full_name' | 'is_relocated' | 'avatar_url' | 'avatar_seed'>;
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

// Points come from organizing, attending and receiving thanks (lib/points.ts)
export interface PointsBreakdown {
  organized: number; // events you organized that already started
  attended: number;
  thanks_received: number;
  passengers: number; // people who came to an event in your car
  points: number;
}

// Everything the profile needs for points, ranks and achievements
export interface ProfileStats extends PointsBreakdown {
  memberships: Membership[];
  attended_events: Event[];
  thanks_sent: number;
}

export interface LeaderboardEntry extends PointsBreakdown {
  user: User;
}

export interface SignUpResult {
  user: User | null;
  needsEmailConfirmation: boolean; // true: the account is created, the user must click the email link
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
  chat_url?: string | null;
  parking_code?: string | null;
}

export interface NewEventInput {
  group_id: string;
  title: string;
  date_time: string;
  location: string;
  lat?: number | null;
  lon?: number | null;
  poster?: PickedFile | null;
}


// A file chosen with expo-image-picker / expo-document-picker, before upload
export interface PickedFile {
  uri: string;
  mimeType: string;
  name: string;
}
