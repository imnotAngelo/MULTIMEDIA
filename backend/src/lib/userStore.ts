import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AuthUserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  instructor_approved?: boolean;
  year_level?: number | null;
  teaching_year_levels?: number[];
  section?: string | null;
  avatar_url?: string | null;
  xp_total: number;
  streak_days: number;
  created_at: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorePath = path.resolve(__dirname, '../../data/auth-users.json');
let authUsersFilePath = process.env.AUTH_USERS_FILE || defaultStorePath;

export function setAuthUsersFile(filePath: string) {
  authUsersFilePath = filePath;
}

function ensureStoreFile() {
  const storeDir = path.dirname(authUsersFilePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(authUsersFilePath)) {
    fs.writeFileSync(authUsersFilePath, JSON.stringify({}, null, 2));
  }
}

function readStore(): Record<string, AuthUserRecord> {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(authUsersFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, AuthUserRecord>;
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(users: Record<string, AuthUserRecord>) {
  ensureStoreFile();
  fs.writeFileSync(authUsersFilePath, JSON.stringify(users, null, 2));
}

export function findUserByEmail(email: string): AuthUserRecord | null {
  const normalizedEmail = email.toLowerCase();
  const store = readStore();
  const user = Object.values(store).find((entry) => entry.email.toLowerCase() === normalizedEmail);
  return user ?? null;
}

export function findUserById(id: string): AuthUserRecord | null {
  const store = readStore();
  const user = Object.values(store).find((entry) => entry.id === id);
  return user ?? null;
}

export function createUser(user: Omit<AuthUserRecord, 'created_at'>): AuthUserRecord {
  const store = readStore();
  const createdAt = new Date().toISOString();
  const record: AuthUserRecord = {
    ...user,
    created_at: createdAt,
  };

  store[record.email.toLowerCase()] = record;
  writeStore(store);
  return record;
}

export function listUsersByRole(role: string): AuthUserRecord[] {
  return Object.values(readStore()).filter((user) => user.role === role);
}

export function updateUser(id: string, updates: Partial<AuthUserRecord>): AuthUserRecord | null {
  const store = readStore();
  const entry = Object.entries(store).find(([, user]) => user.id === id);
  if (!entry) return null;

  const [key, user] = entry;
  const updatedUser = { ...user, ...updates };
  store[key] = updatedUser;
  writeStore(store);
  return updatedUser;
}
