import test from 'node:test';
import assert from 'node:assert/strict';
import { toRoman, fromRoman, extractLessonNumber, getNextLessonTitle } from './lessonNaming';

test('toRoman converts integers to correct Roman numerals', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(2), 'II');
  assert.equal(toRoman(3), 'III');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(5), 'V');
  assert.equal(toRoman(6), 'VI');
  assert.equal(toRoman(7), 'VII');
  assert.equal(toRoman(8), 'VIII');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(10), 'X');
  assert.equal(toRoman(11), 'XI');
  assert.equal(toRoman(14), 'XIV');
  assert.equal(toRoman(19), 'XIX');
  assert.equal(toRoman(20), 'XX');
});

test('fromRoman parses Roman numerals correctly', () => {
  assert.equal(fromRoman('i'), 1);
  assert.equal(fromRoman('I'), 1);
  assert.equal(fromRoman('II'), 2);
  assert.equal(fromRoman('iii'), 3);
  assert.equal(fromRoman('IV'), 4);
  assert.equal(fromRoman('V'), 5);
  assert.equal(fromRoman('VI'), 6);
  assert.equal(fromRoman('IX'), 9);
  assert.equal(fromRoman('X'), 10);
});

test('extractLessonNumber detects lesson numbers in various forms', () => {
  assert.equal(extractLessonNumber('LESSON I'), 1);
  assert.equal(extractLessonNumber('lesson i'), 1);
  assert.equal(extractLessonNumber('lesson 1'), 1);
  assert.equal(extractLessonNumber('Lesson 1'), 1);
  assert.equal(extractLessonNumber('LESSON 1'), 1);
  assert.equal(extractLessonNumber('Lesson I: Introduction'), 1);
  assert.equal(extractLessonNumber('Lesson II'), 2);
  assert.equal(extractLessonNumber('lesson ii'), 2);
  assert.equal(extractLessonNumber('Lesson 2'), 2);
  assert.equal(extractLessonNumber('Lesson III: Advanced'), 3);
  assert.equal(extractLessonNumber('Lesson 3'), 3);
  assert.equal(extractLessonNumber('Lesson IV'), 4);
  assert.equal(extractLessonNumber('Lesson 4'), 4);
});

test('getNextLessonTitle handles user requirement: LESSON I or lesson i or lesson 1 -> Lesson II', () => {
  assert.equal(getNextLessonTitle(['LESSON I']), 'Lesson II');
  assert.equal(getNextLessonTitle(['lesson i']), 'Lesson II');
  assert.equal(getNextLessonTitle(['lesson 1']), 'Lesson II');
  assert.equal(getNextLessonTitle(['Lesson 1']), 'Lesson II');
});

test('getNextLessonTitle handles empty list and sequential progression', () => {
  assert.equal(getNextLessonTitle([]), 'Lesson I');
  assert.equal(getNextLessonTitle(['Lesson I', 'Lesson II']), 'Lesson III');
  assert.equal(getNextLessonTitle(['Lesson 1', 'Lesson 2']), 'Lesson III');
  assert.equal(getNextLessonTitle(['Lesson I', 'Lesson II', 'Lesson III']), 'Lesson IV');
  assert.equal(getNextLessonTitle([{ title: 'Lesson I' }, { title: 'Lesson II' }]), 'Lesson III');
});

