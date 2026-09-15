import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackQuizQuestions, normalizeGeneratedQuestions } from '../src/routes/lessons.ts';

test('normalizeGeneratedQuestions drops repeated-answer identification items', () => {
  const questions = normalizeGeneratedQuestions(
    [
      {
        text: 'What concept is represented by this description?',
        type: 'identification',
        correctAnswer: 'Photosynthesis',
      },
      {
        text: 'Identify the concept introduced in the lesson.',
        type: 'identification',
        correctAnswer: 'Photosynthesis',
      },
      {
        text: 'Identify the term described by the lesson content.',
        type: 'identification',
        correctAnswer: 'Chlorophyll',
      },
    ],
    5,
    ['identification'],
    'short',
    { identification: 2 },
    { identification: 5 },
  );

  assert.equal(questions.length, 2);
  assert.deepEqual(questions.map((question) => question.correctAnswer), ['Photosynthesis', 'Chlorophyll']);
});

test('buildFallbackQuizQuestions stops instead of repeating the same source fact', () => {
  const questions = buildFallbackQuizQuestions(
    'Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs sunlight for the process.',
    5,
    ['identification'],
    { identification: 2 },
    { identification: 5 },
  );

  assert.equal(questions.length, 2);
  assert.notEqual(questions[0]?.correctAnswer, questions[1]?.correctAnswer);
});
