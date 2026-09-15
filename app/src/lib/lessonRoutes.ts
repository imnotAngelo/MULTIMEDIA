export interface LessonRouteRecord {
  id?: unknown;
  lessonId?: unknown;
  lesson_id?: unknown;
  unitId?: unknown;
  unit_id?: unknown;
  moduleId?: unknown;
  module_id?: unknown;
}

const normalizeRouteSegment = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
};

export const getLessonRouteLessonId = (lesson: LessonRouteRecord): string =>
  normalizeRouteSegment(lesson.id) ||
  normalizeRouteSegment(lesson.lessonId) ||
  normalizeRouteSegment(lesson.lesson_id);

export const getLessonRouteUnitId = (lesson: LessonRouteRecord, fallbackUnitId?: unknown): string =>
  normalizeRouteSegment(lesson.unitId) ||
  normalizeRouteSegment(lesson.unit_id) ||
  normalizeRouteSegment(lesson.moduleId) ||
  normalizeRouteSegment(lesson.module_id) ||
  normalizeRouteSegment(fallbackUnitId);

export const buildInstructorLessonPath = (lesson: LessonRouteRecord, fallbackUnitId?: unknown): string | null => {
  const lessonId = getLessonRouteLessonId(lesson);
  const unitId = getLessonRouteUnitId(lesson, fallbackUnitId);

  if (!lessonId || !unitId) {
    return null;
  }

  return `/instructor/lesson/${encodeURIComponent(unitId)}/${encodeURIComponent(lessonId)}`;
};
