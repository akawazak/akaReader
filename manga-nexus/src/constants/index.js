import { BookOpen, Check, Calendar, X, Star } from 'lucide-react';

export const CONFIG = {
  API: 'http://localhost:3001/api',
  SUWAYOMI: 'http://localhost:4567',
  DEBOUNCE_DELAY: 300,
  UPDATE_INTERVAL: 3600000,
};

export const LANGUAGES = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt-br', label: 'Portuguese' },
  { value: 'id', label: 'Indonesian' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'tr', label: 'Turkish' },
  { value: 'ru', label: 'Russian' },
];

export const CATEGORIES = [
  { id: 'reading', name: 'Reading', color: '#f97316', icon: BookOpen },
  { id: 'completed', name: 'Completed', color: '#22c55e', icon: Check },
  { id: 'planning', name: 'Plan to Read', color: '#3b82f6', icon: Calendar },
  { id: 'dropped', name: 'Dropped', color: '#ef4444', icon: X },
  { id: 'favorites', name: 'Favorites', color: '#f59e0b', icon: Star },
];

export const THEMES = {
  dark: { bg: '#080a0e', card: '#16161f', accent: '#f97316', label: 'Dark', text: 'rgba(255,255,255,0.9)' },
  abyss: { bg: '#030303', card: '#0d0d0d', accent: '#f97316', label: 'Abyss', text: 'rgba(255,255,255,0.85)' },
  sepia: { bg: '#1c1714', card: '#2a241e', accent: '#d4956a', label: 'Sepia', text: 'rgba(240,220,195,0.92)' },
  warm: { bg: '#13100e', card: '#1e1916', accent: '#fb923c', label: 'Warm', text: 'rgba(255,235,210,0.9)' },
  midnight: { bg: '#080e1a', card: '#0f1929', accent: '#60a5fa', label: 'Night', text: 'rgba(200,220,255,0.9)' },
  forest: { bg: '#0a110c', card: '#131a14', accent: '#4ade80', label: 'Forest', text: 'rgba(210,240,215,0.9)' },
  rose: { bg: '#140a0e', card: '#1f1115', accent: '#fb7185', label: 'Rose', text: 'rgba(255,210,220,0.9)' },
  slate: { bg: '#0c0e12', card: '#141720', accent: '#94a3b8', label: 'Slate', text: 'rgba(220,225,240,0.9)' },
  paper: { bg: '#f4f0e8', card: '#ede9df', accent: '#92400e', label: 'Paper', text: 'rgba(40,30,20,0.9)' },
  white: { bg: '#ffffff', card: '#f5f5f7', accent: '#f97316', label: 'White', text: 'rgba(10,10,10,0.9)' },
};

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'alphabetical', label: 'A–Z' },
  { value: 'new', label: 'Newly Added' },
  { value: 'rating', label: 'Top Rated' },
];

export const CONTENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'novel', label: 'Novel' },
];
