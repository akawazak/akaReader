import { CONFIG } from '../constants';

export const proxyImg = (url) => {
  if (!url) return null;
  if (url.startsWith('http://localhost:4567') || url.startsWith('/')) {
    const absolute = url.startsWith('/') ? `${CONFIG.SUWAYOMI}${url}` : url;
    return `${CONFIG.API}/img?url=${encodeURIComponent(absolute)}`;
  }
  return url; 
};

export const timeAgo = (ts) => { 
  if (!ts) return ''; 
  const d = Date.now() - ts, 
        m = Math.floor(d / 60000), 
        h = Math.floor(d / 3600000), 
        dy = Math.floor(d / 86400000); 
  if (m < 1) return 'just now'; 
  if (m < 60) return `${m}m ago`; 
  if (h < 24) return `${h}h ago`; 
  if (dy < 7) return `${dy}d ago`; 
  return `${Math.floor(dy / 7)}w ago`; 
};

export const storage = {
  get: (key, defaultValue) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  },
};

export const debounce = (fn, delay) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
};

export const calculateStreak = (history) => {
  if (!history?.length) return 0;
  const dates = [...new Set(history.map(h => new Date(h.lastRead).toDateString()))]
    .sort((a, b) => new Date(b) - new Date(a));
  if (!dates.length) return 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};
