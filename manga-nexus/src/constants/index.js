export const CONFIG = {
  API: 'http://localhost:3001/api',
  SUWAYOMI: 'http://localhost:4567',
  API_TOKEN: typeof window !== 'undefined' ? (window.electronAPI?.apiToken || '') : '',
  DEBOUNCE_DELAY: 350,
  UPDATE_INTERVAL: 3600000,
};

export const CATEGORIES = [
  { id: 'reading', name: 'Reading', color: '#f97316' },
  { id: 'plan', name: 'Plan to Read', color: '#8b5cf6' },
  { id: 'finished', name: 'Finished', color: '#10b981' },
  { id: 'dropped', name: 'Dropped', color: '#ef4444' },
  { id: 'favorites', name: 'Favorites', color: '#eab308' },
];

export const THEMES = {
  dark: { bg: '#0b0d12', card: '#121621', accent: '#f97316', label: 'Dark', text: 'rgba(255,255,255,0.92)' },
  abyss: { bg: '#06080d', card: '#0e1320', accent: '#38bdf8', label: 'Abyss', text: 'rgba(230,240,255,0.92)' },
  sepia: { bg: '#1a1410', card: '#241c16', accent: '#f59e0b', label: 'Sepia', text: 'rgba(255,245,235,0.9)' },
  slate: { bg: '#0c0e12', card: '#141720', accent: '#94a3b8', label: 'Slate', text: 'rgba(220,225,240,0.9)' },
  paper: { bg: '#f4f0e8', card: '#ede9df', accent: '#92400e', label: 'Paper', text: 'rgba(40,30,20,0.9)' },
  white: { bg: '#ffffff', card: '#f5f5f7', accent: '#f97316', label: 'White', text: 'rgba(10,10,10,0.9)' },
};
