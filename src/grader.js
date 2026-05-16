export function gradeVariant(variant, answers) {
  const taskResults = variant.tasks.map((task, index) => {
    const userAnswer = answers[task.id] ?? null;
    const result = gradeTask(task, userAnswer);

    return {
      number: index + 1,
      taskId: task.id,
      title: task.title,
      maxScore: task.maxScore,
      userAnswer,
      correctAnswer: task.answer,
      correctAnswerText: formatCorrectAnswer(task),
      ...result,
    };
  });

  const score = taskResults.reduce((sum, item) => sum + item.score, 0);
  const maxScore = variant.maxScore;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const mark = getMark(score, variant.gradeScale);

  return {
    score,
    maxScore,
    percent,
    mark,
    taskResults,
  };
}

export function gradeTask(task, userAnswer) {
  switch (task.type) {
    case 'singleChoice':
      return gradeExact(task, userAnswer);
    case 'multipleChoice':
      return gradeSet(task, userAnswer);
    case 'dropdownGroup':
      return gradePartialByErrors(task, userAnswer);
    case 'dragToSlots':
      return gradeDragByCorrectCount(task, userAnswer);
    default:
      return {
        score: 0,
        status: 'wrong',
        errors: 1,
      };
  }
}

export function gradeExact(task, userAnswer) {
  const isCorrect = userAnswer === task.answer;

  return {
    score: isCorrect ? task.maxScore : 0,
    status: isCorrect ? 'correct' : 'wrong',
    errors: isCorrect ? 0 : 1,
  };
}

export function gradeSet(task, userAnswer = []) {
  const expected = normalizeSet(task.answer);
  const actual = normalizeSet(userAnswer);
  const isCorrect = expected.length === actual.length && expected.every((value) => actual.includes(value));

  return {
    score: isCorrect ? task.maxScore : 0,
    status: isCorrect ? 'correct' : 'wrong',
    errors: isCorrect ? 0 : countSetErrors(expected, actual),
  };
}

export function gradePartialByErrors(task, userAnswer = {}) {
  const expectedEntries = Object.entries(task.answer);
  const errors = expectedEntries.reduce((count, [key, value]) => {
    return count + (userAnswer?.[key] === value ? 0 : 1);
  }, 0);
  const partialScore = task.partialScore ?? 1;
  const score = errors === 0 ? task.maxScore : errors === 1 ? partialScore : 0;

  return {
    score,
    status: errors === 0 ? 'correct' : errors === 1 ? 'partial' : 'wrong',
    errors,
  };
}

export function gradeDragByCorrectCount(task, userAnswer = {}) {
  const correctCount = Object.entries(task.answer).reduce((count, [slotId, cardId]) => {
    return count + (userAnswer?.[slotId] === cardId ? 1 : 0);
  }, 0);
  const scoreMap = task.scoreMap ?? {};
  const score = Number(scoreMap[String(correctCount)] ?? 0);

  return {
    score,
    status: score === task.maxScore ? 'correct' : score > 0 ? 'partial' : 'wrong',
    errors: Object.keys(task.answer).length - correctCount,
    correctCount,
  };
}

export function getMark(score, gradeScale = []) {
  const matched = gradeScale.find((item) => score >= item.min && score <= item.max);
  return matched ? matched.mark : '—';
}

export function formatCorrectAnswer(task) {
  switch (task.type) {
    case 'singleChoice':
      return getOptionLabel(task.options, task.answer);
    case 'multipleChoice':
      return task.answer.map((id) => getOptionLabel(task.options, id)).join('; ');
    case 'dropdownGroup':
      return task.items
        .map((item) => `${item.label}: ${getOptionLabel(item.options, task.answer[item.id])}`)
        .join('; ');
    case 'dragToSlots':
      return task.slots
        .map((slot) => `${slot.label}: ${getCardLabel(task.cards, task.answer[slot.id])}`)
        .join('; ');
    default:
      return 'Нет данных';
  }
}

function normalizeSet(value) {
  return Array.isArray(value) ? [...value].sort() : [];
}

function countSetErrors(expected, actual) {
  const missing = expected.filter((value) => !actual.includes(value)).length;
  const extra = actual.filter((value) => !expected.includes(value)).length;
  return missing + extra;
}

function getOptionLabel(options, id) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function getCardLabel(cards, id) {
  return cards.find((card) => card.id === id)?.label ?? id;
}
