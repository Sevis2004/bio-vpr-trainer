export function gradeVariant(variant, answers) {
  const taskResults = variant.tasks.map((task, index) => gradeVariantTask(task, index, answers));

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

function gradeVariantTask(task, index, answers) {
  const parts = getTaskParts(task);
  const partResults = parts.map((part) => gradePartTask(part, answers));
  const usesGroupedScoring = hasParts(task) && task.scoring;
  const groupScore = usesGroupedScoring
    ? gradeTask(task, buildGroupAnswer(task, answers), answers).score
    : partResults.reduce((sum, item) => sum + item.score, 0);

  return {
    number: index + 1,
    taskId: task.id,
    title: task.title,
    maxScore: task.maxScore,
    score: groupScore,
    status: getStatus(groupScore, task.maxScore),
    errors: partResults.reduce((sum, item) => sum + item.errors, 0),
    partResults,
  };
}

function gradePartTask(task, answers) {
  const userAnswer = answers[task.id] ?? getEmptyAnswer(task);
  const result = gradeTask(task, userAnswer, answers);

  return {
    number: task.id,
    taskId: task.id,
    title: task.title,
    maxScore: task.maxScore,
    userAnswer,
    correctAnswer: task.answer,
    correctDisplay: task.correctDisplay ?? task.correctAnswerText ?? null,
    correctAnswerText: formatCorrectAnswer(task),
    ...result,
  };
}

export function gradeTask(task, userAnswer, allAnswers = {}) {
  const scoring = task.scoring ?? getDefaultScoring(task.type);

  switch (scoring) {
    case 'exact':
      return gradeExact(task, userAnswer);
    case 'setExact':
      return gradeSet(task, userAnswer);
    case 'partialByErrors':
      return gradePartialByErrors(task, userAnswer);
    case 'countCorrect':
      return gradeByCorrectCount(task, userAnswer);
    case 'twoElements':
      return gradeTwoElements(task, userAnswer);
    case 'firstElementRequired':
      return gradeFirstElementRequired(task, userAnswer);
    case 'allOrNothing':
      return gradeAllOrNothing(task, userAnswer);
    case 'dependentCriterion':
      return gradeDependentCriterion(task, userAnswer, allAnswers);
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
  return gradeByCorrectCount(task, userAnswer);
}

export function gradeByCorrectCount(task, userAnswer = {}) {
  const correctCount = Object.entries(task.answer).reduce((count, [slotId, expectedValue]) => {
    return count + (userAnswer?.[slotId] === expectedValue ? 1 : 0);
  }, 0);
  const score = getScoreByCorrectCount(task, correctCount);

  return {
    score,
    status: score === task.maxScore ? 'correct' : score > 0 ? 'partial' : 'wrong',
    errors: Object.keys(task.answer).length - correctCount,
    correctCount,
  };
}

export function gradeTwoElements(task, userAnswer = {}) {
  const correctCount = countCorrectElements(task, userAnswer);
  const score = correctCount === 2 ? 2 : correctCount === 1 ? 1 : 0;

  return buildElementResult(task, score, Object.keys(task.answer).length - correctCount, correctCount);
}

export function gradeFirstElementRequired(task, userAnswer = {}) {
  const entries = Object.entries(task.answer);
  const [firstKey, firstValue] = entries[0] ?? [];
  const firstCorrect = firstKey !== undefined && userAnswer?.[firstKey] === firstValue;
  const secondCorrect = entries.slice(1).some(([key, value]) => userAnswer?.[key] === value);
  const score = firstCorrect ? (secondCorrect ? task.maxScore : 1) : 0;
  const correctCount = Number(firstCorrect) + Number(secondCorrect);

  return buildElementResult(task, score, entries.length - correctCount, correctCount);
}

export function gradeAllOrNothing(task, userAnswer = {}) {
  const errors = countErrors(task, userAnswer);
  const score = errors === 0 ? task.maxScore : 0;

  return {
    score,
    status: errors === 0 ? 'correct' : 'wrong',
    errors,
  };
}

export function gradeDependentCriterion(task, userAnswer, allAnswers = {}) {
  const dependency = parseDependency(task.dependsOn);
  const dependencyAnswer = dependency ? allAnswers?.[dependency.taskId]?.[dependency.itemId] : undefined;
  const dependencyExpected = dependency ? task.dependsOnAnswer ?? task.dependencyAnswer : undefined;
  const dependencyCorrect = dependencyExpected !== undefined && dependencyAnswer === dependencyExpected;
  const answerCorrect = userAnswer === task.answer;
  const isCorrect = dependencyCorrect && answerCorrect;

  return {
    score: isCorrect ? task.maxScore : 0,
    status: isCorrect ? 'correct' : 'wrong',
    errors: isCorrect ? 0 : 1,
  };
}

export function getMark(score, gradeScale = []) {
  const matched = gradeScale.find((item) => score >= item.min && score <= item.max);
  return matched ? (matched.mark ?? matched.grade) : '—';
}

export function formatCorrectAnswer(task) {
  const display = task.correctDisplay ?? task.correctAnswerText;
  if (display && typeof display !== 'object') return display;

  switch (task.type) {
    case 'singleChoice':
    case 'dropdown':
      return getOptionLabel(task.options, task.answer);
    case 'multipleChoice':
      return task.answer.map((id) => getOptionLabel(task.options, id)).join('; ');
    case 'dropdownGroup':
      return task.items
        .map((item) => `${item.label}: ${display?.[item.id] ?? getOptionLabel(getDropdownOptions(task, item), task.answer[item.id])}`)
        .join('; ');
    case 'dragToSlots':
      return task.slots
        .map((slot) => `${slot.label}: ${display?.[slot.id] ?? getCardLabel(task.cards, task.answer[slot.id])}`)
        .join('; ');
    default:
      return 'Нет данных';
  }
}

function getTaskParts(task) {
  return hasParts(task) ? task.parts : [task];
}

function hasParts(task) {
  return Array.isArray(task.parts) && task.parts.length > 0;
}

function buildGroupAnswer(task, answers) {
  return Object.fromEntries(getTaskParts(task).map((part) => [part.id, answers[part.id] ?? getEmptyAnswer(part)]));
}

function getEmptyAnswer(task) {
  if (task.type === 'multipleChoice') return [];
  if (task.type === 'dropdownGroup' || task.type === 'dragToSlots') return {};
  return null;
}

function getStatus(score, maxScore) {
  if (score === maxScore) return 'correct';
  if (score > 0) return 'partial';
  return 'wrong';
}

function getDefaultScoring(type) {
  return {
    singleChoice: 'exact',
    dropdown: 'exact',
    multipleChoice: 'setExact',
    dropdownGroup: 'partialByErrors',
    dragToSlots: 'countCorrect',
  }[type];
}

function getScoreByCorrectCount(task, correctCount) {
  const scoreMap = task.scoreMap ?? {};
  if (scoreMap[String(correctCount)] !== undefined) {
    return Number(scoreMap[String(correctCount)]);
  }
  if (correctCount === Object.keys(task.answer).length) return task.maxScore;
  if (correctCount === Object.keys(task.answer).length - 1) return 1;
  return 0;
}

function buildElementResult(task, score, errors, correctCount) {
  return {
    score,
    status: score === task.maxScore ? 'correct' : score > 0 ? 'partial' : 'wrong',
    errors,
    correctCount,
  };
}

function countCorrectElements(task, userAnswer = {}) {
  return Object.entries(task.answer).reduce((count, [key, value]) => count + (userAnswer?.[key] === value ? 1 : 0), 0);
}

function countErrors(task, userAnswer = {}) {
  return Object.entries(task.answer).reduce((count, [key, value]) => count + (userAnswer?.[key] === value ? 0 : 1), 0);
}

function parseDependency(value) {
  if (!value) return null;
  const index = value.lastIndexOf('.');
  if (index === -1) return null;
  return {
    taskId: value.slice(0, index),
    itemId: value.slice(index + 1),
  };
}

function normalizeSet(value) {
  return Array.isArray(value) ? [...value].sort() : [];
}

function countSetErrors(expected, actual) {
  const missing = expected.filter((value) => !actual.includes(value)).length;
  const extra = actual.filter((value) => !expected.includes(value)).length;
  return missing + extra;
}

function getDropdownOptions(task, item) {
  return item.options ?? task.optionsBySlot?.[item.id] ?? task.options ?? [];
}

function getOptionLabel(options = [], id) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function getCardLabel(cards, id) {
  return cards.find((card) => card.id === id)?.label ?? id;
}
