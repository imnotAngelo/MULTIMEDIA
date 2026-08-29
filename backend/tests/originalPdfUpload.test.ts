import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOriginalPdfLessonRecord, normalizeGeneratedQuestions } from '../src/routes/lessons.ts';

test('keeps uploaded PDFs as original documents without slide generation', () => {
  const record = buildOriginalPdfLessonRecord({
    title: 'Original PDF Lesson',
    description: 'Keep this file as uploaded',
    moduleId: '8d78f6f6-9c42-4f7b-9975-2c4c6d4c7d1a',
    fileName: 'lesson-123.pdf',
    fileUrl: '/uploads/lesson-123.pdf',
    videoUrl: 'https://example.com/lesson-video.mp4',
    graphicUrl: '/uploads/lesson-graphics/lesson-graphic.png',
  });

  assert.equal(record.slideCount, 0);
  assert.deepEqual(record.slides, []);
  assert.equal(record.content, 'Keep this file as uploaded');
  assert.equal(record.pdfUrl, '/uploads/lesson-123.pdf');
  assert.equal(record.videoUrl, 'https://example.com/lesson-video.mp4');
  assert.equal(record.graphicUrl, '/uploads/lesson-graphics/lesson-graphic.png');
  assert.equal(record.originalFormat, 'pdf');
});

test('removes duplicate generated questions and keeps only valid multiple-choice answers', () => {
  const questions = [
    { id: '1', text: 'What is the main idea?', type: 'multiple-choice', points: 2, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
    { id: '2', text: '  What is the main idea?  ', type: 'multiple-choice', points: 2, options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' },
    { id: '3', text: 'Explain the process in one sentence.', type: 'short-answer', points: 3, options: [], correctAnswer: '' },
    { id: '4', text: '', type: 'multiple-choice', points: 2, options: ['A', 'A', 'A', 'A'], correctAnswer: 'A' },
    { id: '5', text: 'Which item is correct?', type: 'multiple-choice', points: 2, options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 'One' },
  ];

  const normalized = normalizeGeneratedQuestions(questions, 3);

  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].text, 'What is the main idea?');
  assert.equal(normalized[1].text, 'Explain the process in one sentence.');
  assert.equal(normalized[2].text, 'Which item is correct?');
  assert.ok(normalized.every((q) => q.text.trim().length > 0));
  assert.ok(normalized.every((q) => q.points >= 1));
});
