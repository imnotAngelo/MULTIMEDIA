import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  type: 'unit' | 'lesson' | 'assignment' | 'achievement';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: uuidv4(),
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
    }));

    // Auto-clear after 10 seconds
    setTimeout(() => {
      get().clearNotification(newNotification.id);
    }, 10000);

    // Also persist to localStorage
    const state = get();
    localStorage.setItem('notifications', JSON.stringify(state.notifications));
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      ),
    }));

    const state = get();
    localStorage.setItem('notifications', JSON.stringify(state.notifications));
  },

  clearNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notif) => notif.id !== id),
    }));

    const state = get();
    localStorage.setItem('notifications', JSON.stringify(state.notifications));
  },

  clearAll: () => {
    set({ notifications: [] });
    localStorage.removeItem('notifications');
  },

  getUnreadCount: () => {
    const state = get();
    return state.notifications.filter((n) => !n.read).length;
  },
}));
