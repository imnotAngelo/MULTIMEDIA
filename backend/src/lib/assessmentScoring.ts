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
    const isShortAnswer = String(question.type || '').toLowerCase() === 'short-answer';
    const isCorrect = Boolean(submittedAnswer) && (
      isShortAnswer
        ? submittedAnswer.toLowerCase() === expectedAnswer.toLowerCase()
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

  return {
    score: possiblePoints > 0 ? Number(((earnedPoints / possiblePoints) * 100).toFixed(2)) : 0,
    earnedPoints,
    possiblePoints,
    results,
  };
}
