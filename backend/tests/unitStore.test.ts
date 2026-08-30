import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalUnit, listLocalUnits, setUnitsStoreFile } from '../src/lib/unitStore.ts';
import { createLocalLesson, listLocalLessonsByModuleId, setLessonsStoreFile } from '../src/lib/lessonStore.ts';
import { getUnitLessons } from '../src/controllers/unitsController.ts';
import { buildOriginalPdfLessonRecord, getUploadedFile, getUploadedGraphicFile } from '../src/routes/lessons.ts';
import { buildConvertedLessonRecord } from '../src/routes/convert.ts';

test('stores units in the fallback unit store and lists them', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'units-store-'));
  const tempFile = path.join(tempDir, 'units.json');
  setUnitsStoreFile(tempFile);

  const createdUnit = createLocalUnit({
    id: 'unit-1',
    courseId: 'course-1',
    title: 'Intro to Design',
    description: 'A sample unit',
    status: 'active',
  });

  const units = listLocalUnits();

  assert.ok(createdUnit);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.title, 'Intro to Design');
  assert.equal(units[0]?.id, 'unit-1');
});

test('stores lessons in the fallback lesson store and lists them by unit', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-store-'));
  const tempFile = path.join(tempDir, 'lessons.json');
  setLessonsStoreFile(tempFile);

  const createdLesson = createLocalLesson({
    id: 'lesson-1',
    moduleId: 'unit-1',
    title: 'Intro Lesson',
    content: 'A sample lesson',
    slides: [{ title: 'Slide 1' }],
    slideCount: 1,
    status: 'published',
  });

  const lessons = listLocalLessonsByModuleId('unit-1');

  assert.ok(createdLesson);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0]?.title, 'Intro Lesson');
  assert.equal(lessons[0]?.moduleId, 'unit-1');
});

test('returns the locally stored lessons for a unit even when the database client is unavailable', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-store-'));
  const tempFile = path.join(tempDir, 'lessons.json');
  setLessonsStoreFile(tempFile);

  createLocalLesson({
    id: 'lesson-local-2',
    moduleId: 'unit-2',
    title: 'Fallback Lesson',
    content: 'Stored locally',
    slides: [{ title: 'Slide 1' }],
    slideCount: 1,
    status: 'published',
  });

  const req = {
    params: { unitId: 'unit-2' },
  } as any;

  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;

  await getUnitLessons(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.ok(Array.isArray(res.body?.data));
  assert.equal(res.body?.data[0]?.title, 'Fallback Lesson');
  assert.equal(res.body?.data[0]?.unitId, 'unit-2');
});

test('creates a PDF lesson record with extracted content instead of an empty placeholder', () => {
  const extractedText = 'This is the first section of a sample lesson. This is the second section with more information.';

  const lesson = buildOriginalPdfLessonRecord({
    lessonId: 'lesson-pdf-1',
    title: 'Sample PDF Lesson',
    description: '',
    moduleId: '11111111-1111-4111-8111-111111111111',
    fileName: 'sample.pdf',
    fileUrl: '/uploads/sample.pdf',
    pdfText: extractedText,
  });

  assert.equal(lesson.content.includes('This is the first section'), true);
  assert.equal(lesson.content.length > 0, true);
  assert.equal(lesson.originalFormat, 'pdf');
});

test('returns the PDF upload file instead of the optional graphic asset', () => {
  const pdfFile = { fieldname: 'file', originalname: 'lesson.pdf', path: '/tmp/lesson.pdf' } as any;
  const graphicFile = { fieldname: 'graphicFile', originalname: 'cover.png', path: '/tmp/cover.png' } as any;
  const req = {
    files: {
      file: [pdfFile],
      graphicFile: [graphicFile],
    },
  } as any;

  assert.equal(getUploadedFile(req), pdfFile);
  assert.equal(getUploadedGraphicFile(req), graphicFile);
});

test('keeps converted PPT lessons attached to the selected unit and preserves the file URL', () => {
  const unitId = '11111111-1111-4111-8111-111111111111';

  const record = buildConvertedLessonRecord({
    id: 'lesson-ppt-1',
    unitId,
    title: 'Week 3 Presentation',
    content: 'Converted presentation generated from source material.',
    fileUrl: '/uploads/week-3-presentation.pptx',
    originalFormat: 'pptx',
  });

  assert.equal(record.unitId, unitId);
  assert.equal(record.moduleId, unitId);
  assert.equal(record.pdfUrl, '/uploads/week-3-presentation.pptx');
  assert.equal(record.originalFormat, 'pptx');
  assert.equal(record.fileUrl, '/uploads/week-3-presentation.pptx');
});
