import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  type: 'unit' | 'lesson' | 'quiz' | 'lab' | 'assignment' | 'achievement' | 'announcement';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  setFromApi: (rows: any[]) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: (() => {
    try {
      const raw = localStorage.getItem('notifications');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })(),

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: uuidv4(),
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
    }));
  },

  setFromApi: (rows) => {
    const mapped: Notification[] = rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      timestamp: new Date(r.created_at).getTime(),
      read: r.read ?? false,
      attachmentUrl: r.attachment_url ?? null,
      attachmentName: r.attachment_name ?? null,
    }));
    set({ notifications: mapped });
    localStorage.setItem('notifications', JSON.stringify(mapped));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    localStorage.setItem('notifications', JSON.stringify(get().notifications));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    localStorage.setItem('notifications', JSON.stringify(get().notifications));
  },

  clearNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
    localStorage.setItem('notifications', JSON.stringify(get().notifications));
  },

  clearAll: () => {
    set({ notifications: [] });
    localStorage.removeItem('notifications');
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },
}));

