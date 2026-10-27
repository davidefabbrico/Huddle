// Data model types. They mirror the tables in supabase/schema.sql
// (lib/api.ts maps the Supabase rows to these shapes).

export type UserRole = 'solo' | 'group';
export type UserIntent = 'friends' | 'group' | 'friends_and_dating';
export type GroupType = 'closed' | 'open_to_new';
export type GroupVisibility = 'public' | 'private'; // private: only members and invite links
export type MemberRole = 'admin' | 'member';
export type JoinStatus = 'pending' | 'guest' | 'accepted' | 'rejected';
export type RsvpStatus = 'going' | 'not_going'; // "Ci sono" / "Non ci sono"
export type Transport = 'car' | 'need_ride' | 'own'; // "In auto" / "Mi serve un passaggio" / "Per conto mio"
export type RideStatus = 'requested' | 'accepted'; // the passenger asked, the driver accepted
export type EventKind = 'event' | 'trip'; // "Evento" / "Vacanza" (several days, with a plan)
export type AccountType = 'person' | 'business'; // "Persona" / "Locale o azienda"
export type EventVisibility = 'public' | 'private'; // private: only the group's members and guests
export type NotificationType =
  | 'join_request' // to the admin: someone wants to join
  | 'request_accepted'
  | 'request_guest'
  | 'request_rejected'
  | 'new_event' // to members: a new event in their group
  | 'rank_up' // to you: you reached a new rank in a group
  | 'thanks' // to you: someone thanked you for an event
  | 'ride' // rides: someone asks you (driver), or the driver answered you
  | 'expense' // someone added an expense that includes you, or paid you back
  | 'promo' // a venue near your groups invites you to its event
  | 'digest' // weekly newsletter: events for you
  | 'event_update'; // an event you're going to changed date or place, or was cancelled

// ---- Tables ----

export interface User {
  id: string;
  full_name: string;
  bio: string;
  is_relocated: boolean;
  relocated_at: string | null; // YYYY-MM-DD, roughly when they moved to the city
  interests: string[];
  hide_activity: boolean; // never counted in other people's "Per te" suggestions
  // Avatar: a photo if avatar_url is set, else a pixel identicon if avatar_seed is set, else initials
  avatar_url: string | null;
  avatar_seed: string | null;
  role: UserRole;
  intent: UserIntent;
  account_type: AccountType;
}

// Private settings, readable only by you (age and area are not on the public profile)
export interface UserSettings {
  birth_year: number | null;
  area: string | null; // "your area", for distances
  area_lat: number | null;
  area_lon: number | null;
  search_radius_km: number;
  newsletter: boolean; // weekly "La tua settimana" in Attività
  accept_promos: boolean; // events of venues near your groups
}

export interface Group {
  id: string;
  name: string;
  description: string;
  admin_id: string;
  location: string;
  type: GroupType;
  visibility: GroupVisibility;
  invite_code: string; // secret part of the invite link /invite/<code>
  // Group "photo": emoji + tile color from lib/groupIcons.ts (null = suggested from the name)
  icon: string | null;
  color: string | null;
  expenses_enabled: boolean; // shared expenses ("Spese") on events; holidays always have them
  lat: number | null; // where they meet (from the "Zona" search)
  lon: number | null;
  age_min: number | null; // the ages it's for (either end may be open)
  age_max: number | null;
  tags: string[]; // what they're into (from interestOptions)
  is_business: boolean; // a venue's page: anyone can answer its events
}

// What an invite link shows before joining (also for private groups)
export interface InvitePreview {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  type: GroupType;
  visibility: GroupVisibility;
  member_count: number;
  my_status: 'member' | JoinStatus | null;
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
  tags: string[]; // what it's about (from interestOptions): drives "Per te"
  series_id: string | null; // occurrence of a recurring event
  kind: EventKind;
  ends_at: string | null; // holidays: the last day (ISO 8601)
  visibility: EventVisibility;
  cancelled_at: string | null; // "Annullato": stays visible, nobody can answer
}

// Holiday plan item: something to do or to see, optionally on a day. Every member can edit it.
export interface TripItem {
  id: string;
  event_id: string;
  kind: 'todo' | 'see';
  title: string;
  day: string | null; // YYYY-MM-DD
  done: boolean;
  created_by: string | null;
  updated_by: string | null;
  votes: string[]; // who voted for it: the most voted come first
}

// One photo per person per event, seen by whoever sees the group
export interface EventPhoto {
  event_id: string;
  user_id: string;
  url: string;
  created_at: string;
}

// Shared expense (like Splitwise): who paid and each person's share, in cents.
// A settlement is a payment from a debtor to a creditor (one share).
export interface Expense {
  id: string;
  event_id: string;
  paid_by: string;
  amount_cents: number;
  description: string;
  is_settlement: boolean;
  created_by: string | null;
  created_at: string;
  shares: { user_id: string; amount_cents: number }[];
}

// The group's history (group_history): past events with how many came and their photos, who joined
export interface GroupHistory {
  created_at: string;
  events: (Pick<Event, 'id' | 'title' | 'kind' | 'date_time' | 'ends_at' | 'location' | 'series_id'> & {
    going: number;
    photos: string[];
  })[];
  members: { user_id: string; full_name: string; joined_at: string }[];
}

// Recurring event ("Palestra lun, mer, ven alle 19"): its occurrences are normal events, created two weeks ahead
export interface EventSeries {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string;
  weekdays: number[]; // 1 = Monday … 7 = Sunday
  start_time: string; // "19:00:00", local time of the series
  starts_on: string | null; // first and last day, "YYYY-MM-DD" (no end: dates four weeks ahead)
  ends_on: string | null;
}

// "Ci sono ogni volta": usual choices added to each new occurrence
export interface SeriesRegular {
  series_id: string;
  user_id: string;
  transport: Transport | null;
  seats: number;
  depart_area: string | null;
  depart_time: string | null;
  ride_with: string | null; // the usual driver (once they accepted)
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
  depart_area: string | null; // driver: where they leave from (an area, never a live position)
  depart_time: string | null; // driver: "18:30:00"
  ride_with: string | null; // the driver a passenger asked
  ride_status: RideStatus | null;
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
  group_icon: string | null;
  group_color: string | null;
  group_type: GroupType;
  group_age_min: number | null;
  group_age_max: number | null;
  group_is_business: boolean;
  series: Pick<EventSeries, 'id' | 'weekdays' | 'start_time' | 'created_by' | 'starts_on' | 'ends_on'> | null;
}

export interface AttendeeWithProfile extends User {
  status: RsvpStatus;
  checked_in: boolean;
  transport: Transport | null;
  seats: number;
  depart_area: string | null;
  depart_time: string | null;
  ride_with: string | null;
  ride_status: RideStatus | null;
}

// "Per te" signals from the database: counts only, never names (people with hide_activity are left out)
export interface ForYouSignals {
  events: { event_id: string; mates_going: number; similar_going: number; newcomers_going: number }[];
  taste: Record<string, number>; // what the people in your groups like: interest/tag -> weight
  mine: Record<string, number>; // tags of the events you went to
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
  account_type?: AccountType;
  birth_year?: number | null;
}

export interface NewGroupInput {
  name: string;
  description: string;
  location: string;
  type: GroupType;
  visibility?: GroupVisibility;
  icon?: string | null;
  color?: string | null;
  expenses_enabled?: boolean;
  lat?: number | null;
  lon?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  tags?: string[];
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
  tags?: string[];
  poster?: PickedFile | null;
  // Every week on these days (1 = Monday) at the time of date_time: creates a recurring event
  repeat_weekdays?: number[] | null;
  kind?: EventKind; // 'trip': a holiday from date_time to ends_at
  ends_at?: string | null;
  visibility?: EventVisibility;
  repeat_until?: string | null; // recurring: the last day, "YYYY-MM-DD" (the first is the day of date_time)
}

// What the organizer can change after creating an event
export type EventChanges = Partial<Pick<Event, 'title' | 'date_time' | 'ends_at' | 'location' | 'lat' | 'lon' | 'tags' | 'visibility'>>;


// A file chosen with expo-image-picker / expo-document-picker, before upload
export interface PickedFile {
  uri: string;
  mimeType: string;
  name: string;
}
