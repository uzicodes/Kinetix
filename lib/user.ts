const ADJECTIVES = [
  'Swift', 'Clever', 'Bright', 'Cosmic', 'Nimble',
  'Solar', 'Lunar', 'Neon', 'Astral', 'Hyper', 'Zenith', 'Vivid'
];

const ANIMALS = [
  'Falcon', 'Fox', 'Otter', 'Lynx', 'Phoenix',
  'Panda', 'Eagle', 'Dolphin', 'Tiger', 'Hawk', 'Koala', 'Wolf'
];

const PALETTE = [
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#F43F5E', // Rose
  '#14B8A6', // Teal
];

export interface UserSession {
  name: string;
  color: string;
}

const STORAGE_KEY = 'kinetix_peer_session';

export function getOrCreateUserSession(): UserSession {
  if (typeof window === 'undefined') {
    return { name: 'Anonymous Peer', color: '#10B981' };
  }

  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // ignore
    }
  }

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const session: UserSession = {
    name: `${adj} ${animal}`,
    color,
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

