export interface LessonFormatRecord {
  pdfUrl?: unknown;
  originalFormat?: unknown;
  slides?: unknown;
  slideCount?: unknown;
}

export const isPdfLessonRecord = (lesson: LessonFormatRecord): boolean => {
  if (typeof lesson.originalFormat === 'string' && lesson.originalFormat.toLowerCase() === 'pdf') {
    return true;
  }

  return typeof lesson.pdfUrl === 'string' && lesson.pdfUrl.trim().length > 0;
};
