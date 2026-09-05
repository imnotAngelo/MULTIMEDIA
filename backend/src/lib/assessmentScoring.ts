export type AssessmentQuestionLike = {
  id?: string | number;
  questionId?: string | number;
  type?: string;
  points?: number | string;
  correctAnswer?: string | number | null;
};

export type AssessmentAnswerLike = {
  questionId?: string | number;
  answer?: string | number | null;
};

function normalizeShortAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getShortAnswerSimilarity(studentAnswer: string, expectedAnswer: string) {
  const normalizedStudent = normalizeShortAnswer(studentAnswer);
  const normalizedExpected = normalizeShortAnswer(expectedAnswer);

  if (!normalizedStudent || !normalizedExpected) return 0;

  if (normalizedStudent === normalizedExpected) return 1;

  const studentTokens = normalizedStudent.split(' ').filter(Boolean);
  const expectedTokens = normalizedExpected.split(' ').filter(Boolean);
  if (studentTokens.length === 0 || expectedTokens.length === 0) return 0;

  const studentSet = new Set(studentTokens);
  const expectedSet = new Set(expectedTokens);
  const overlap = studentTokens.filter((token) => expectedSet.has(token)).length;
  const keywordSimilarity = overlap / Math.max(studentTokens.length, expectedTokens.length);

  const minLength = Math.min(studentTokens.length, expectedTokens.length);
  const matchingOrder = studentTokens.slice(0, minLength).filter((token, index) => token === expectedTokens[index]).length;
  const sequenceSimilarity = minLength > 0 ? matchingOrder / minLength : 0;

  return Math.max(keywordSimilarity, sequenceSimilarity);
}

export function scoreAssessmentSubmission(
  questions: AssessmentQuestionLike[],
  answers: AssessmentAnswerLike[]
) {
  const answerByQuestion = new Map(
    answers.map((entry) => [String(entry.questionId), String(entry.answer ?? '').trim()])
  );

  let possiblePoints = 0;
  let earnedPoints = 0;

  const results = questions.map((question) => {
    const points = Number(question.points) || 0;
    const submittedAnswer = answerByQuestion.get(String(question.id ?? question.questionId)) || '';
    const expectedAnswer = String(question.correctAnswer ?? '').trim();
    const normalizedType = String(question.type || '').toLowerCase();
    const isShortAnswer = ['short-answer', 'enumeration', 'identification', 'essay'].includes(normalizedType);
    const isTrueFalse = normalizedType === 'true-false';

    const isCorrect = Boolean(submittedAnswer) && (
      isShortAnswer
        ? (() => {
            const similarity = getShortAnswerSimilarity(submittedAnswer, expectedAnswer);
            return similarity >= 0.5 || submittedAnswer.toLowerCase() === expectedAnswer.toLowerCase();
          })()
        : isTrueFalse
          ? normalizeShortAnswer(submittedAnswer) === normalizeShortAnswer(expectedAnswer)
          : submittedAnswer === expectedAnswer
    );

    possiblePoints += points;
    if (isCorrect) earnedPoints += points;

    return {
      questionId: String(question.id ?? question.questionId),
      isCorrect,
      earnedPoints: isCorrect ? points : 0,
    };
  });

  const percentageScore = possiblePoints > 0 ? Number(((earnedPoints / possiblePoints) * 100).toFixed(2)) : 0;

  return {
    score: Math.round(earnedPoints),
    percentageScore,
    earnedPoints,
    possiblePoints,
    results,
  };
}
