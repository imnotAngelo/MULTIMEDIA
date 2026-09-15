import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInstructorLessonPath,
  getLessonRouteLessonId,
  getLessonRouteUnitId,
} from './lessonRoutes.ts';

test('buildInstructorLessonPath uses normalized ids from mixed lesson payload keys', () => {
  assert.equal(
    buildInstructorLessonPath({
      lesson_id: ' lesson-123 ',
      module_id: ' unit-456 ',
    }),
    '/instructor/lesson/unit-456/lesson-123',
  );
});

test('buildInstructorLessonPath uses fallback unit id when lesson payload omits it', () => {
  assert.equal(
    buildInstructorLessonPath({
      id: 'lesson-123',
    }, 'unit-456'),
    '/instructor/lesson/unit-456/lesson-123',
  );
});

test('buildInstructorLessonPath returns null when either segment is missing', () => {
  assert.equal(buildInstructorLessonPath({ id: 'lesson-123' }), null);
  assert.equal(buildInstructorLessonPath({ unitId: 'unit-456' }), null);
});

test('route id helpers prefer normalized non-empty values', () => {
  assert.equal(getLessonRouteLessonId({ id: ' ', lessonId: 'lesson-123' }), 'lesson-123');
  assert.equal(getLessonRouteUnitId({ unitId: '', module_id: 'unit-456' }), 'unit-456');
});
