/**
 * Utility functions for automatically numbering and naming lessons sequentially
 * using Roman numerals (Lesson I, Lesson II, Lesson III, etc.)
 */

export function toRoman(num: number): string {
  if (num <= 0 || !Number.isInteger(num)) return 'I';

  const romanMap: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let n = num;
  for (const [val, sym] of romanMap) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

export function fromRoman(roman: string): number | null {
  const str = roman.toUpperCase().trim();
  if (!str) return null;

  // Validate standard Roman numeral pattern
  if (!/^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(str)) {
    return null;
  }

  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const curr = map[str[i]];
    const next = map[str[i + 1]];
    if (!curr) return null;
    if (next && curr < next) {
      total += next - curr;
      i++;
    } else {
      total += curr;
    }
  }

  return total > 0 ? total : null;
}

/**
 * Extracts a lesson number from various title formats, handling:
 * - "LESSON I", "lesson i", "Lesson I"
 * - "lesson 1", "Lesson 1", "LESSON 1"
 * - "Lesson II", "Lesson 2"
 * - "Lesson 1: Intro", "Lesson I - Getting Started"
 * - "1. Intro", "I. Intro"
 */
export function extractLessonNumber(title: string): number | null {
  if (!title) return null;
  const clean = title.trim();

  // 1. Matches "Lesson" followed optionally by punctuation or spaces, then Roman or Arabic number
  // e.g. "LESSON I", "lesson i", "lesson 1", "Lesson 2", "Lesson III", "Lesson-04"
  const lessonPattern = /\blessons?\s*[:#-]?\s*([ivxlcdm]+|\d+)\b/i;
  const match = clean.match(lessonPattern);
  if (match) {
    const val = match[1];
    if (/^\d+$/.test(val)) {
      const num = parseInt(val, 10);
      if (num > 0) return num;
    } else {
      const romanVal = fromRoman(val);
      if (romanVal) return romanVal;
    }
  }

  // 2. Starts with Roman numeral or number followed by punctuation/space: "I. Title" or "1. Title"
  const startPattern = /^([ivxlcdm]+|\d+)[.\s:–-]/i;
  const startMatch = clean.match(startPattern);
  if (startMatch) {
    const val = startMatch[1];
    if (/^\d+$/.test(val)) {
      const num = parseInt(val, 10);
      if (num > 0) return num;
    } else {
      const romanVal = fromRoman(val);
      if (romanVal) return romanVal;
    }
  }

  return null;
}

/**
 * Computes the next automatic lesson title (e.g. "Lesson I", "Lesson II", "Lesson III", etc.)
 * based on existing lessons in the unit or course.
 *
 * If existing lessons include "LESSON I", "lesson i", or "lesson 1", it returns "Lesson II".
 */
export function getNextLessonTitle(existingLessons: Array<{ title?: string } | string> | null | undefined): string {
  if (!existingLessons || !Array.isArray(existingLessons) || existingLessons.length === 0) {
    return 'Lesson I';
  }

  const titles = existingLessons
    .map((l) => (typeof l === 'string' ? l : l?.title || ''))
    .map((t) => t.trim())
    .filter(Boolean);

  if (titles.length === 0) {
    return 'Lesson I';
  }

  let maxNumberFound = 0;
  for (const title of titles) {
    const num = extractLessonNumber(title);
    if (num !== null && num > maxNumberFound) {
      maxNumberFound = num;
    }
  }

  if (maxNumberFound > 0) {
    return `Lesson ${toRoman(maxNumberFound + 1)}`;
  }

  // If there are existing lessons with non-numbered titles, use total count + 1
  return `Lesson ${toRoman(titles.length + 1)}`;
}

