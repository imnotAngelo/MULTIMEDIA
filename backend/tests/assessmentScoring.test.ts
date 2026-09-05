import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreAssessmentSubmission } from '../src/lib/assessmentScoring.js';

test('scores multiple-choice and short-answer responses using the real backend logic', () => {
  const questions = [
    { id: 'q1', type: 'multiple-choice', points: 10, correctAnswer: 'Paris' },
    { id: 'q2', type: 'short-answer', points: 15, correctAnswer: 'Photosynthesis' },
  ];

  const result = scoreAssessmentSubmission(questions, [
    { questionId: 'q1', answer: ' Paris ' },
    { questionId: 'q2', answer: 'photosynthesis' },
  ]);

  assert.equal(result.score, 25);
  assert.equal(result.earnedPoints, 25);
  assert.equal(result.possiblePoints, 25);
  assert.deepEqual(result.results, [
    { questionId: 'q1', isCorrect: true, earnedPoints: 10 },
    { questionId: 'q2', isCorrect: true, earnedPoints: 15 },
  ]);
});

test('marks incorrect answers as wrong and lowers the score', () => {
  const questions = [
    { id: 'q1', type: 'multiple-choice', points: 10, correctAnswer: 'Paris' },
    { id: 'q2', type: 'short-answer', points: 15, correctAnswer: 'Photosynthesis' },
  ];

  const result = scoreAssessmentSubmission(questions, [
    { questionId: 'q1', answer: 'Rome' },
    { questionId: 'q2', answer: 'Cellular respiration' },
  ]);

  assert.equal(result.score, 0);
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.possiblePoints, 25);
  assert.deepEqual(result.results, [
    { questionId: 'q1', isCorrect: false, earnedPoints: 0 },
    { questionId: 'q2', isCorrect: false, earnedPoints: 0 },
  ]);
});

test('accepts close short-answer responses when they are relevant enough', () => {
  const questions = [
    { id: 'q1', type: 'short-answer', points: 5, correctAnswer: 'The process plants use to make food using sunlight' },
  ];

  const result = scoreAssessmentSubmission(questions, [
    { questionId: 'q1', answer: 'Plants use sunlight to make food' },
  ]);

  assert.equal(result.score, 5);
  assert.equal(result.earnedPoints, 5);
  assert.equal(result.results[0].isCorrect, true);
});
