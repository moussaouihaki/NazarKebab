import { create } from 'zustand';
import { Platform } from 'react-native';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string, message: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  hydrate: () => void;
}

const STORAGE_KEY = 'nazar_notifications';

// Safe read/write without any dynamic imports or import.meta
function safeRead(): AppNotification[] {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function safeWrite(notifications: AppNotification[]) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    }
  } catch {}
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  hydrate: () => {
    const saved = safeRead();
    const unread = saved.filter(n => !n.read).length;
    set({ notifications: saved, unreadCount: unread });
  },

  addNotification: (title, message) => {
    const existing = get().notifications;
    const now = Date.now();
    // Anti-doublon : ignorer si même titre+message dans les 3 dernières secondes
    const isDuplicate = existing.some(n =>
      n.title === title &&
      n.message === message &&
      now - new Date(n.time).getTime() < 3000
    );
    if (isDuplicate) return;

    const newNotif: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...existing].slice(0, 50);
    safeWrite(updated);
    set({ notifications: updated, unreadCount: get().unreadCount + 1 });
  },

  markAllAsRead: () => {
    const updated = get().notifications.map(n => ({ ...n, read: true }));
    safeWrite(updated);
    set({ notifications: updated, unreadCount: 0 });
  },

  clearAll: () => {
    safeWrite([]);
    set({ notifications: [], unreadCount: 0 });
  },
}));
