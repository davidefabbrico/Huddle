// External group chats (WhatsApp, Telegram, Signal, Discord…): validation and app detection

export interface ChatApp {
  name: string;
  icon: 'logo-whatsapp' | 'paper-plane' | 'chatbubble-ellipses' | 'logo-discord' | 'open-outline';
  color: string;
}

const apps: { hosts: string[]; app: ChatApp }[] = [
  { hosts: ['chat.whatsapp.com', 'wa.me', 'whatsapp.com'], app: { name: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' } },
  { hosts: ['t.me', 'telegram.me'], app: { name: 'Telegram', icon: 'paper-plane', color: '#229ED9' } },
  { hosts: ['signal.group', 'signal.me'], app: { name: 'Signal', icon: 'chatbubble-ellipses', color: '#3A76F0' } },
  { hosts: ['discord.gg', 'discord.com'], app: { name: 'Discord', icon: 'logo-discord', color: '#5865F2' } },
];

const otherApp: ChatApp = { name: 'chat esterna', icon: 'open-outline', color: '#57534E' };

function hostOf(url: string): string | null {
  const match = url.trim().match(/^https:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase().replace(/^www\./, '') : null;
}

export function detectChatApp(url: string): ChatApp {
  const host = hostOf(url);
  return apps.find((a) => host && a.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.app ?? otherApp;
}

// Error message, or null if the link is fine. Empty means "no link".
export function validateChatLink(url: string): string | null {
  if (!url.trim()) return null;
  if (!hostOf(url)) return 'Il link deve iniziare con https:// (es. https://chat.whatsapp.com/…)';
  return null;
}
