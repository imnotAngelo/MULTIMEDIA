import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface LocalLesson {
  id: string;
  moduleId: string;
  instructorId?: string;
  title: string;
  content?: string;
  slides?: any[];
  slideCount?: number;
  status?: string;
  createdAt?: string;
  pdfUrl?: string;
  originalFormat?: string;
  videoUrl?: string;
  graphicUrl?: string;
}

const LEGACY_DEFAULT_INSTRUCTOR_ID = '12345678-1234-4234-8234-123456789012';

export function normalizeInstructorId(instructorId?: string | null): string | null {
  if (typeof instructorId !== 'string') return null;
  const normalized = instructorId.trim();
  if (!normalized || normalized === 'anonymous' || normalized === LEGACY_DEFAULT_INSTRUCTOR_ID) {
    return null;
  }
  return normalized;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(moduleDir, '..', '..');
let lessonsStoreFilePath = path.join(backendRoot, 'data', 'lessons.json');

export function setLessonsStoreFile(filePath: string) {
  lessonsStoreFilePath = filePath;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
}

function readLessonsStore(): LocalLesson[] {
  try {
    const raw = fs.readFileSync(lessonsStoreFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLessonsStore(lessons: LocalLesson[]) {
  fs.writeFileSync(lessonsStoreFilePath, JSON.stringify(lessons, null, 2));
}

function sanitizeLocalLessons(lessons: LocalLesson[]): LocalLesson[] {
  return lessons.filter((lesson) => {
    const ownerId = normalizeInstructorId(lesson?.instructorId);
    return Boolean(lesson?.id) && Boolean(lesson?.moduleId) && Boolean(lesson?.title) && Boolean(ownerId);
  });
}

export function createLocalLesson(lesson: LocalLesson): LocalLesson {
  const lessons = sanitizeLocalLessons(readLessonsStore());
  const normalizedInstructorId = normalizeInstructorId(lesson.instructorId);
  const nextLesson = {
    ...lesson,
    instructorId: normalizedInstructorId ?? undefined,
    createdAt: lesson.createdAt || new Date().toISOString(),
  };

  if (!nextLesson.instructorId) {
    return nextLesson;
  }

  lessons.push(nextLesson);
  writeLessonsStore(lessons);
  return nextLesson;
}

export function listLocalLessons(): LocalLesson[] {
  return sanitizeLocalLessons(readLessonsStore());
}

export function listLocalLessonsForInstructor(instructorId: string): LocalLesson[] {
  const normalizedInstructorId = normalizeInstructorId(instructorId);
  if (!normalizedInstructorId) return [];
  return sanitizeLocalLessons(readLessonsStore()).filter(
    (lesson) => normalizeInstructorId(lesson.instructorId) === normalizedInstructorId,
  );
}

export function listLocalLessonsByModuleId(moduleId: string): LocalLesson[] {
  return sanitizeLocalLessons(readLessonsStore()).filter((lesson) => lesson.moduleId === moduleId);
}

export function listLocalLessonsByModuleIdForInstructor(moduleId: string, instructorId: string): LocalLesson[] {
  const normalizedInstructorId = normalizeInstructorId(instructorId);
  if (!normalizedInstructorId) return [];
  return listLocalLessonsByModuleId(moduleId).filter(
    (lesson) => normalizeInstructorId(lesson.instructorId) === normalizedInstructorId,
  );
}

export function getLocalLessonById(id: string): LocalLesson | undefined {
  return readLessonsStore().find((lesson) => lesson.id === id);
}
