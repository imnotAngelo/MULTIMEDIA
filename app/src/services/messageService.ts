import { authFetch } from '@/lib/authFetch';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'instructor' | 'admin';
  avatar_url: string | null;
  last_message: Message | null;
  unread_count: number;
}

function extractErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.message === 'string') return payload.message;
  if (payload.error && typeof payload.error === 'object') {
    if (typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.error.code === 'string') return payload.error.code;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return fallback;
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const text = await res.text();
      if (text) {
        try {
          const j = JSON.parse(text);
          detail = extractErrorMessage(j, '');
        } catch {
          detail = text;
        }
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const messageService = {
  async listContacts(): Promise<Contact[]> {
    const res = await authFetch('/messages/contacts');
    return jsonOrThrow<Contact[]>(res);
  },

  async getThread(userId: string): Promise<Message[]> {
    const res = await authFetch(`/messages/thread/${userId}`);
    return jsonOrThrow<Message[]>(res);
  },

  async sendMessage(recipientId: string, body: string): Promise<Message> {
    const res = await authFetch('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, body }),
    });
    return jsonOrThrow<Message>(res);
  },

  async markThreadRead(userId: string): Promise<void> {
    const res = await authFetch(`/messages/thread/${userId}/read`, {
      method: 'POST',
    });
    await jsonOrThrow(res);
  },

  async unreadCount(): Promise<number> {
    const res = await authFetch('/messages/unread-count');
    const data = await jsonOrThrow<{ count: number }>(res);
    return data.count ?? 0;
  },
};
