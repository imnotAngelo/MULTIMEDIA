import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPresentationSections } from '../src/routes/convert.js';

test('keeps a wrapped title as one complete heading before generating the next slide', () => {
  const source = `Introduction to Data Structures and Algorithms
Data structures help organize and store information efficiently.

Array and Linked List Basics
Arrays store values in fixed positions while linked lists connect nodes through references.

Sorting and Searching
Sorting groups items in order and searching finds the right element quickly.`;

  const slides = buildPresentationSections(source, 'Lesson');
  assert.equal(slides[0].title, 'Introduction to Data Structures and Algorithms');
  assert.equal(slides[0].body.includes('Data structures help organize and store information efficiently.'), true);
  assert.equal(slides[1].title, 'Array and Linked List Basics');
});

test('accepts full sentence headings when they continue across wrapped lines', () => {
  const source = `The Benefits of Renewable Energy
for Rural Communities
Renewable energy reduces cost and supports local resilience.

Energy Storage and Distribution
Batteries and smart grids keep service stable during peak demand.`;

  const slides = buildPresentationSections(source, 'Lesson');
  assert.equal(slides[0].title, 'The Benefits of Renewable Energy for Rural Communities');
  assert.equal(slides[1].title, 'Energy Storage and Distribution');
});
