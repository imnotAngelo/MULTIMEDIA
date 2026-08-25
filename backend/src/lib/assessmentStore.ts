import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';

export interface LocalAssessmentRecord {
  id: string;
  created_by: string;
  title: string;
  description: string;
  type: string;
  due_date?: string | null;
  total_points?: number | null;
  module_id?: string | null;
  status?: string;
  questions_data?: unknown;
  time_limit?: number | null;
  shuffle_questions?: boolean | null;
  show_correct_answers?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStorePath = path.resolve(__dirname, '../../data/assessments.json');
const assessmentStorePath = process.env.ASSESSMENTS_STORE_FILE || defaultStorePath;

const seedAssessments: LocalAssessmentRecord[] = [
  {
    id: 'seed-quiz-001',
    created_by: 'local-instructor',
    title: 'Quick Quiz: Intro to Digital Media',
    description: 'A starter quiz that should appear immediately when the database is unavailable.',
    type: 'quiz',
    due_date: null,
    total_points: 20,
    module_id: 'local-module-1',
    status: 'published',
    questions_data: [
      { id: 'q1', prompt: 'What is the main purpose of a storyboard?', options: ['Plan visuals', 'Delete files', 'Change color mode'], correctAnswer: 0 },
      { id: 'q2', prompt: 'Which tool is commonly used for compositing?', options: ['Brush', 'Mixer', 'Alpha compositing'], correctAnswer: 2 },
    ],
    time_limit: 10,
    shuffle_questions: false,
    show_correct_answers: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'seed-assignment-001',
    created_by: 'local-instructor',
    title: 'Short Reflection Assignment',
    description: 'A sample assignment used as a fallback when the database is unavailable.',
    type: 'assignment',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    total_points: 50,
    module_id: 'local-module-1',
    status: 'published',
    questions_data: [],
    time_limit: null,
    shuffle_questions: false,
    show_correct_answers: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function ensureStoreFile() {
  const storeDir = path.dirname(assessmentStorePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(assessmentStorePath)) {
    fs.writeFileSync(assessmentStorePath, JSON.stringify(seedAssessments, null, 2));
  }
}

function readStore(): LocalAssessmentRecord[] {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(assessmentStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as LocalAssessmentRecord[];
    }
  } catch {
    // fall through to seeded data
  }

  return [];
}

function writeStore(records: LocalAssessmentRecord[]) {
  ensureStoreFile();
  fs.writeFileSync(assessmentStorePath, JSON.stringify(records, null, 2));
}

export function listLocalAssessments(options?: { filter?: string; page?: number; limit?: number; unitId?: string; createdBy?: string }) {
  const records = readStore();
  const filter = options?.filter;
  const unitId = options?.unitId;
  const createdBy = options?.createdBy;
  const page = options?.page && options.page > 0 ? options.page : 1;
  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
  const offset = (page - 1) * limit;

  const filtered = records.filter((entry) => {
    if (filter && filter !== 'all' && entry.type !== filter) return false;
    if (unitId && entry.module_id !== unitId) return false;
    if (createdBy && entry.created_by !== createdBy) return false;
    return true;
  });

  const paged = filtered.slice(offset, offset + limit);
  return {
    data: paged,
    total: filtered.length,
    page,
    limit,
  };
}

export function getLocalAssessmentById(id: string) {
  return readStore().find((entry) => entry.id === id) || null;
}

export function createLocalAssessment(input: Partial<LocalAssessmentRecord> & { title: string; type: string; created_by?: string }) {
  const records = readStore();
  const record: LocalAssessmentRecord = {
    id: input.id || uuidv4(),
    created_by: input.created_by || 'local-instructor',
    title: input.title,
    description: input.description || '',
    type: input.type,
    due_date: input.due_date || null,
    total_points: input.total_points ?? 100,
    module_id: input.module_id || null,
    status: input.status || 'published',
    questions_data: input.questions_data ?? [],
    time_limit: input.time_limit ?? null,
    shuffle_questions: input.shuffle_questions ?? false,
    show_correct_answers: input.show_correct_answers ?? false,
    created_at: input.created_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
  };

  records.unshift(record);
  writeStore(records);
  return record;
}
