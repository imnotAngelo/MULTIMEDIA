import test from 'node:test';
import assert from 'node:assert/strict';

import { isPdfLessonRecord } from './lessonFormat.js';

test('detects PDF lessons from pdfUrl metadata', () => {
  assert.equal(
    isPdfLessonRecord({ pdfUrl: '/uploads/lesson.pdf', slides: [] }),
    true,
  );
});

test('detects PDF lessons from originalFormat metadata', () => {
  assert.equal(
    isPdfLessonRecord({ originalFormat: 'pdf', slides: [] }),
    true,
  );
});

test('keeps slide lessons as non-PDF when they have no PDF metadata', () => {
  assert.equal(
    isPdfLessonRecord({ slides: [{ id: 1 }], slideCount: 1 }),
    false,
  );
});
