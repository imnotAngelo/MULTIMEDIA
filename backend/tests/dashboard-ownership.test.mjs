import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLessonsStoreFile, createLocalLesson, listLocalLessonsByModuleIdForInstructor } from '../src/lib/lessonStore.ts';
import { setUnitsStoreFile, createLocalUnit, listLocalUnitsForInstructor } from '../src/lib/unitStore.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempLessonsFile = path.join(__dirname, 'tmp-lessons.json');
const tempUnitsFile = path.join(__dirname, 'tmp-units.json');

fs.writeFileSync(tempLessonsFile, JSON.stringify([], null, 2));
fs.writeFileSync(tempUnitsFile, JSON.stringify([], null, 2));
setLessonsStoreFile(tempLessonsFile);
setUnitsStoreFile(tempUnitsFile);

createLocalLesson({
  id: 'lesson-1',
  moduleId: 'unit-1',
  instructorId: 'instructor-a',
  title: 'A lesson',
  content: 'A',
  createdAt: new Date().toISOString(),
});

createLocalLesson({
  id: 'lesson-2',
  moduleId: 'unit-1',
  instructorId: 'instructor-b',
  title: 'B lesson',
  content: 'B',
  createdAt: new Date().toISOString(),
});

createLocalUnit({
  id: 'unit-1',
  courseId: 'course-a',
  instructorId: 'instructor-a',
  title: 'Unit A',
  description: 'A unit',
  createdAt: new Date().toISOString(),
});

createLocalUnit({
  id: 'unit-2',
  courseId: 'course-b',
  instructorId: 'instructor-b',
  title: 'Unit B',
  description: 'B unit',
  createdAt: new Date().toISOString(),
});

const lessonsForA = listLocalLessonsByModuleIdForInstructor('unit-1', 'instructor-a');
const lessonsForB = listLocalLessonsByModuleIdForInstructor('unit-1', 'instructor-b');
const unitsForA = listLocalUnitsForInstructor('instructor-a');
const unitsForB = listLocalUnitsForInstructor('instructor-b');

if (lessonsForA.length !== 1 || lessonsForB.length !== 1) {
  throw new Error(`Unexpected lesson ownership results: ${lessonsForA.length} / ${lessonsForB.length}`);
}

if (unitsForA.length !== 1 || unitsForB.length !== 1) {
  throw new Error(`Unexpected unit ownership results: ${unitsForA.length} / ${unitsForB.length}`);
}

console.log('ownership filter test passed');
