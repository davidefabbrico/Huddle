// Mock dataset used until Supabase is connected. Only lib/api.ts reads it.
// Event and message dates are computed relative to "now" so the feed
// always shows upcoming events, whenever the app is opened.

import type {
  ChatMessage,
  Event,
  EventAttendee,
  Friendship,
  Group,
  GroupMember,
  JoinRequest,
  User,
} from './types';

// ISO date `days` from today at the given local time
function inDays(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ISO date `minutes` ago
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const users: User[] = [
  {
    id: 'u1',
    full_name: 'Giulia Rossi',
    bio: 'Appena trasferita da Bari per lavoro (UX designer). Cerco gente con cui correre e fare brunch la domenica.',
    is_relocated: true,
    interests: ['running', 'brunch', 'cinema', 'design'],
    role: 'solo',
    intent: 'friends',
  },
  {
    id: 'u2',
    full_name: 'Lukas Becker',
    bio: 'Ingegnere, arrivato da Monaco a settembre. Padel, birra artigianale e montagna.',
    is_relocated: true,
    interests: ['padel', 'birra artigianale', 'hiking'],
    role: 'solo',
    intent: 'group',
  },
  {
    id: 'u3',
    full_name: 'Sofia Marino',
    bio: 'Milanese doc, organizzo le corse sui Navigli da tre anni. Tutti i ritmi sono benvenuti!',
    is_relocated: false,
    interests: ['running', 'fotografia', 'aperitivo'],
    role: 'group',
    intent: 'friends',
  },
  {
    id: 'u4',
    full_name: 'Marco Bianchi',
    bio: 'Sviluppatore di giorno, master di giochi da tavolo la sera. Ho più giochi che scaffali.',
    is_relocated: false,
    interests: ['giochi da tavolo', 'videogiochi', 'pizza'],
    role: 'group',
    intent: 'friends',
  },
  {
    id: 'u5',
    full_name: 'Aisha Khan',
    bio: 'Da Londra a Milano per un lavoro in finanza. Yoga, mostre e cucina di ogni parte del mondo.',
    is_relocated: true,
    interests: ['yoga', 'mostre', 'cucina', 'viaggi'],
    role: 'solo',
    intent: 'friends_and_dating',
  },
  {
    id: 'u6',
    full_name: 'Pietro Conti',
    bio: 'Padel ogni giovedì sera, e spesso ci manca il quarto. Fatti avanti!',
    is_relocated: false,
    interests: ['padel', 'calcio', 'cucina'],
    role: 'group',
    intent: 'friends',
  },
  {
    id: 'u7',
    full_name: 'Elena Ferri',
    bio: 'Arrivata da Torino due anni fa, so cosa vuol dire non conoscere nessuno. Ho fondato l’aperitivo del mercoledì.',
    is_relocated: true,
    interests: ['aperitivo', 'lingue', 'teatro'],
    role: 'group',
    intent: 'friends',
  },
  {
    id: 'u8',
    full_name: 'Tomás García',
    bio: 'Da Madrid, lavoro in una startup. Corro male ma con entusiasmo.',
    is_relocated: true,
    interests: ['running', 'calcio', 'musica live'],
    role: 'solo',
    intent: 'group',
  },
  {
    id: 'u9',
    full_name: 'Chiara Gallo',
    bio: 'Ogni weekend in montagna. Organizzo uscite facili e medie, partenza in treno da Centrale.',
    is_relocated: false,
    interests: ['hiking', 'montagna', 'fotografia'],
    role: 'group',
    intent: 'friends',
  },
  {
    id: 'u10',
    full_name: 'Nina Kowalski',
    bio: 'Ricercatrice al Politecnico, da Varsavia. Leggo tanto e parlo ancora poco italiano.',
    is_relocated: true,
    interests: ['libri', 'scrittura', 'caffè'],
    role: 'group',
    intent: 'friends',
  },
];

export const groups: Group[] = [
  {
    id: 'g1',
    name: 'Runners dei Navigli',
    description:
      'Corsa di gruppo da 5 a 10 km lungo i Navigli, martedì sera e domenica mattina. Ritmo tranquillo, poi colazione insieme.',
    admin_id: 'u3',
    location: 'Navigli, Milano',
    type: 'open_to_new',
  },
  {
    id: 'g2',
    name: 'Board Game Night Isola',
    description:
      'Ogni venerdì giochi da tavolo in un bar in Isola. Spieghiamo noi le regole: non serve essere esperti.',
    admin_id: 'u4',
    location: 'Isola, Milano',
    type: 'open_to_new',
  },
  {
    id: 'g3',
    name: 'Padel del Giovedì',
    description:
      'Gruppo di amici che gioca a padel il giovedì sera. Livello intermedio, cerchiamo giocatori per completare i turni.',
    admin_id: 'u6',
    location: 'Città Studi, Milano',
    type: 'open_to_new',
  },
  {
    id: 'g4',
    name: 'Aperitivo & Chiacchiere',
    description:
      'Aperitivo del mercoledì per chi è nuovo in città e per chi vuole conoscere gente nuova. Italiano e inglese.',
    admin_id: 'u7',
    location: 'Porta Venezia, Milano',
    type: 'open_to_new',
  },
  {
    id: 'g5',
    name: 'Hiking Lombardia Weekend',
    description:
      'Escursioni di un giorno in Lombardia e dintorni, raggiungibili in treno. Difficoltà facile e media.',
    admin_id: 'u9',
    location: 'Partenza da Milano Centrale',
    type: 'open_to_new',
  },
  {
    id: 'g6',
    name: 'Book Club Città Studi',
    description:
      'Un libro al mese e una cena per parlarne. Al momento siamo al completo, ma riapriremo presto.',
    admin_id: 'u10',
    location: 'Città Studi, Milano',
    type: 'closed',
  },
];

export const groupMembers: GroupMember[] = [
  // g1 Runners dei Navigli
  { user_id: 'u3', group_id: 'g1', role: 'admin' },
  { user_id: 'u9', group_id: 'g1', role: 'member' },
  { user_id: 'u7', group_id: 'g1', role: 'member' },
  // g2 Board Game Night Isola
  { user_id: 'u4', group_id: 'g2', role: 'admin' },
  { user_id: 'u10', group_id: 'g2', role: 'member' },
  { user_id: 'u6', group_id: 'g2', role: 'member' },
  // g3 Padel del Giovedì (u2 joined via an accepted request)
  { user_id: 'u6', group_id: 'g3', role: 'admin' },
  { user_id: 'u4', group_id: 'g3', role: 'member' },
  { user_id: 'u2', group_id: 'g3', role: 'member' },
  // g4 Aperitivo & Chiacchiere
  { user_id: 'u7', group_id: 'g4', role: 'admin' },
  { user_id: 'u3', group_id: 'g4', role: 'member' },
  { user_id: 'u10', group_id: 'g4', role: 'member' },
  { user_id: 'u8', group_id: 'g4', role: 'member' },
  // g5 Hiking Lombardia Weekend
  { user_id: 'u9', group_id: 'g5', role: 'admin' },
  { user_id: 'u2', group_id: 'g5', role: 'member' },
  { user_id: 'u3', group_id: 'g5', role: 'member' },
  // g6 Book Club Città Studi
  { user_id: 'u10', group_id: 'g6', role: 'admin' },
  { user_id: 'u7', group_id: 'g6', role: 'member' },
  { user_id: 'u4', group_id: 'g6', role: 'member' },
  { user_id: 'u9', group_id: 'g6', role: 'member' },
];

export const events: Event[] = [
  { id: 'e1', group_id: 'g1', title: 'Corsa serale 6 km', date_time: inDays(1, 19, 30), location: 'Darsena, lato Viale Gorizia' },
  { id: 'e2', group_id: 'g1', title: 'Long run domenicale + colazione', date_time: inDays(5, 9), location: 'Alzaia Naviglio Grande 4' },
  { id: 'e3', group_id: 'g2', title: 'Serata Catan & Ticket to Ride', date_time: inDays(3, 20), location: 'Bar Frida, Via Pollaiuolo 3' },
  { id: 'e4', group_id: 'g2', title: 'Torneo di Codenames', date_time: inDays(10, 20), location: 'Bar Frida, Via Pollaiuolo 3' },
  { id: 'e5', group_id: 'g3', title: 'Padel: doppio misto', date_time: inDays(2, 20, 30), location: 'Padel Club Leonardo' },
  { id: 'e6', group_id: 'g3', title: 'Padel + pizza dopo partita', date_time: inDays(9, 20, 30), location: 'Padel Club Leonardo' },
  { id: 'e7', group_id: 'g4', title: 'Aperitivo di benvenuto', date_time: inDays(1, 19), location: 'Lecco Milano, Via Lecco 5' },
  { id: 'e8', group_id: 'g4', title: 'Language exchange IT/EN', date_time: inDays(8, 19), location: 'Rita & Cocktails, Via Fumagalli 1' },
  { id: 'e9', group_id: 'g5', title: 'Anello del Monte Barro', date_time: inDays(6, 8, 15), location: 'Milano Centrale, binario 3' },
  { id: 'e10', group_id: 'g5', title: 'Lago di Como: Sentiero del Viandante', date_time: inDays(13, 8), location: 'Milano Centrale, binario 5' },
  { id: 'e11', group_id: 'g6', title: 'Cena e discussione: "Il Gattopardo"', date_time: inDays(11, 20), location: 'Trattoria Da Pino, Via Pascoli 12' },
  { id: 'e12', group_id: 'g1', title: 'Ripetute al Parco Sempione', date_time: inDays(15, 19), location: 'Arco della Pace' },
];

// Unused in the MVP
export const eventAttendees: EventAttendee[] = [];

export const joinRequests: JoinRequest[] = [
  { id: 'jr1', user_id: 'u2', group_id: 'g3', status: 'accepted' },
  { id: 'jr2', user_id: 'u8', group_id: 'g1', status: 'guest' },
  { id: 'jr3', user_id: 'u5', group_id: 'g4', status: 'pending' },
];

export const chatMessages: ChatMessage[] = [
  // g1
  { id: 'm1', group_id: 'g1', user_id: 'u3', content: 'Domani corsa serale, ritrovo in Darsena alle 19:30!', created_at: minutesAgo(600) },
  { id: 'm2', group_id: 'g1', user_id: 'u8', content: 'Ciao a tutti, sono Tomás, vengo per la prima volta 🙌', created_at: minutesAgo(540) },
  { id: 'm3', group_id: 'g1', user_id: 'u9', content: 'Benvenuto! Andiamo piano, nessuno resta indietro.', created_at: minutesAgo(530) },
  // g2
  { id: 'm4', group_id: 'g2', user_id: 'u4', content: 'Venerdì porto anche Wingspan, chi lo vuole provare?', created_at: minutesAgo(1440) },
  { id: 'm5', group_id: 'g2', user_id: 'u10', content: 'Io! Ma spiegamelo lentamente 😅', created_at: minutesAgo(1400) },
  // g3
  { id: 'm6', group_id: 'g3', user_id: 'u6', content: 'Campo prenotato per giovedì alle 20:30.', created_at: minutesAgo(300) },
  { id: 'm7', group_id: 'g3', user_id: 'u2', content: 'Perfetto, ci sono. Porto le palline nuove.', created_at: minutesAgo(280) },
  // g4
  { id: 'm8', group_id: 'g4', user_id: 'u7', content: 'Mercoledì aperitivo di benvenuto: se conoscete qualcuno appena arrivato, portatelo!', created_at: minutesAgo(900) },
  { id: 'm9', group_id: 'g4', user_id: 'u8', content: 'Ci sarò, l’ultima volta è stata bellissima.', created_at: minutesAgo(860) },
  { id: 'm10', group_id: 'g4', user_id: 'u3', content: 'Prenoto un tavolo per 10?', created_at: minutesAgo(845) },
  // g5
  { id: 'm11', group_id: 'g5', user_id: 'u9', content: 'Sabato Monte Barro: scarpe da trekking e pranzo al sacco.', created_at: minutesAgo(2000) },
  { id: 'm12', group_id: 'g5', user_id: 'u2', content: 'Il treno delle 8:15 va bene per tutti?', created_at: minutesAgo(1950) },
  // g6
  { id: 'm13', group_id: 'g6', user_id: 'u10', content: 'Ricordate di finire il libro entro la cena 📚', created_at: minutesAgo(3000) },
];

// Unused in the MVP
export const friendships: Friendship[] = [];

// Demo login accounts (email -> user id). In Supabase, emails live in auth.users,
// not in the public users table. Any password works with the mock layer.
export const mockAccounts: Record<string, string> = {
  'giulia@huddle.app': 'u1',
  'lukas@huddle.app': 'u2',
  'sofia@huddle.app': 'u3',
  'aisha@huddle.app': 'u5',
};
