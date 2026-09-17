import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  setUnitsStoreFile,
  createLocalUnit,
  listLocalUnitsForInstructor,
  normalizeInstructorId as normalizeUnitInstructorId,
} from '../src/lib/unitStore.ts';
import {
  setLessonsStoreFile,
  createLocalLesson,
  listLocalLessonsByModuleIdForInstructor,
  normalizeInstructorId as normalizeLessonInstructorId,
} from '../src/lib/lessonStore.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempLessonsFile = path.join(__dirname, 'tmp-scope-lessons.json');
const tempUnitsFile = path.join(__dirname, 'tmp-scope-units.json');

fs.writeFileSync(tempLessonsFile, JSON.stringify([], null, 2));
fs.writeFileSync(tempUnitsFile, JSON.stringify([], null, 2));
setLessonsStoreFile(tempLessonsFile);
setUnitsStoreFile(tempUnitsFile);

assert.equal(normalizeUnitInstructorId('anonymous'), null);
assert.equal(normalizeUnitInstructorId('12345678-1234-4234-8234-123456789012'), null);
assert.equal(normalizeUnitInstructorId('user-abc-123'), 'user-abc-123');

assert.equal(normalizeLessonInstructorId('anonymous'), null);
assert.equal(normalizeLessonInstructorId('12345678-1234-4234-8234-123456789012'), null);
assert.equal(normalizeLessonInstructorId('user-xyz-456'), 'user-xyz-456');

createLocalUnit({
  id: 'unit-1',
  courseId: 'course-a',
  instructorId: 'real-user-a',
  title: 'Unit A',
  description: 'Owned by A',
  createdAt: new Date().toISOString(),
});

createLocalUnit({
  id: 'unit-2',
  courseId: 'course-b',
  instructorId: 'real-user-b',
  title: 'Unit B',
  description: 'Owned by B',
  createdAt: new Date().toISOString(),
});

createLocalLesson({
  id: 'lesson-1',
  moduleId: 'unit-1',
  instructorId: 'real-user-a',
  title: 'Lesson A',
  content: 'A',
  createdAt: new Date().toISOString(),
});

createLocalLesson({
  id: 'lesson-2',
  moduleId: 'unit-2',
  instructorId: 'real-user-b',
  title: 'Lesson B',
  content: 'B',
  createdAt: new Date().toISOString(),
});

assert.equal(listLocalUnitsForInstructor('real-user-a').length, 1);
assert.equal(listLocalUnitsForInstructor('real-user-b').length, 1);
assert.equal(listLocalUnitsForInstructor('12345678-1234-4234-8234-123456789012').length, 0);
assert.equal(listLocalLessonsByModuleIdForInstructor('unit-1', 'real-user-a').length, 1);
assert.equal(listLocalLessonsByModuleIdForInstructor('unit-2', 'real-user-a').length, 0);
assert.equal(listLocalLessonsByModuleIdForInstructor('unit-1', '12345678-1234-4234-8234-123456789012').length, 0);

console.log('ownership scoping regression test passed');
