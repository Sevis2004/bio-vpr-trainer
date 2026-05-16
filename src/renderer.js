import { readDragAnswer, setupDragToSlots } from './dnd.js';

export function renderVariant(variant, container, onChange) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  variant.tasks.forEach((task, index) => {
    const card = document.createElement('article');
    card.className = 'task-card';
    card.dataset.taskId = task.id;
    card.innerHTML = `
      <div class="task-head">
        <div class="task-number">Задание ${escapeHtml(task.id ?? index + 1)}</div>
        <div class="task-points">${task.maxScore} ${formatPoints(task.maxScore)}</div>
      </div>
      <h2>${escapeHtml(task.title)}</h2>
      ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
      <div class="task-body"></div>
    `;

    const body = card.querySelector('.task-body');
    renderTask(task, body, onChange);
    fragment.append(card);
  });

  container.append(fragment);
}

export function readAnswers(variant, container) {
  return Object.fromEntries(
    getGradableTasks(variant).map((task) => {
      const taskElement = container.querySelector(`[data-answer-id="${CSS.escape(task.id)}"]`);
      return [task.id, readTaskAnswer(task, taskElement)];
    }),
  );
}

export function countAnsweredTasks(variant, container) {
  const answers = readAnswers(variant, container);

  return variant.tasks.filter((task) => {
    const parts = getTaskParts(task);
    return parts.every((part) => isAnswered(part, answers[part.id]));
  }).length;
}

export function applyResults(container, result) {
  clearResults(container);

  result.taskResults.forEach((taskResult) => {
    const card = container.querySelector(`[data-task-id="${CSS.escape(taskResult.taskId)}"]`);
    if (!card) return;

    card.classList.add(statusClass(taskResult.status));
    card.querySelectorAll('input, select, button').forEach((control) => {
      control.disabled = true;
    });

    taskResult.partResults.forEach((partResult) => {
      const partElement = card.querySelector(`[data-answer-id="${CSS.escape(partResult.taskId)}"]`);
      if (partElement) markCorrectAnswers(partElement, partResult);
    });
  });
}

export function clearResults(container) {
  container.querySelectorAll('.task-card').forEach((card) => {
    card.classList.remove('is-correct', 'is-partial', 'is-wrong');
    card.querySelectorAll('input, select, button').forEach((control) => {
      control.disabled = false;
    });
    card.querySelectorAll('.is-right-answer').forEach((element) => {
      element.classList.remove('is-right-answer');
    });
    card.querySelectorAll('.badge.ok').forEach((badge) => {
      badge.remove();
    });
  });
}

function renderTask(task, body, onChange) {
  const parts = getTaskParts(task);

  if (parts.length === 1 && parts[0] === task) {
    body.dataset.answerId = task.id;
    body.dataset.taskType = task.type;
    renderTaskBody(task, body, onChange);
    return;
  }

  parts.forEach((part) => {
    const section = document.createElement('section');
    section.className = 'task-part';
    section.dataset.answerId = part.id;
    section.dataset.taskType = part.type;
    section.innerHTML = `
      <h3>${escapeHtml(part.title)}</h3>
      ${part.description ? `<p class="task-description">${escapeHtml(part.description)}</p>` : ''}
    `;
    renderTaskBody(part, section, onChange);
    body.append(section);
  });
}

function renderTaskBody(task, body, onChange) {
  switch (task.type) {
    case 'singleChoice':
      renderChoice(task, body, 'radio', onChange);
      break;
    case 'multipleChoice':
      renderChoice(task, body, 'checkbox', onChange);
      break;
    case 'dropdown':
      renderDropdown(task, body, onChange);
      break;
    case 'dropdownGroup':
      renderDropdownGroup(task, body, onChange);
      break;
    case 'dragToSlots':
      renderDragToSlots(task, body, onChange);
      break;
    default:
      body.insertAdjacentHTML('beforeend', '<div class="empty-state">Неизвестный тип задания.</div>');
  }
}

function renderChoice(task, body, inputType, onChange) {
  const options = document.createElement('div');
  options.className = 'options';

  task.options.forEach((option) => {
    const id = `${task.id}-${option.id}`;
    const label = document.createElement('label');
    label.className = 'option';
    label.dataset.optionId = option.id;
    label.innerHTML = `
      <input type="${inputType}" id="${escapeAttribute(id)}" name="${escapeAttribute(task.id)}" value="${escapeAttribute(option.id)}" />
      <span>${escapeHtml(option.label)}</span>
    `;
    label.querySelector('input').addEventListener('change', onChange);
    options.append(label);
  });

  body.append(options);
}

function renderDropdown(task, body, onChange) {
  renderStrictHint(task, body);

  const wrapper = document.createElement('label');
  wrapper.className = 'dropdown-item';
  wrapper.innerHTML = `
    <strong>${escapeHtml(task.label ?? 'Ответ')}</strong>
    <select class="task-select" name="${escapeAttribute(task.id)}">
      <option value="">${escapeHtml(getPlaceholder(task))}</option>
      ${task.options
        .map((option) => `<option value="${escapeAttribute(option.id)}">${escapeHtml(option.label)}</option>`)
        .join('')}
    </select>
  `;
  wrapper.querySelector('select').addEventListener('change', onChange);
  body.append(wrapper);
}

function renderDropdownGroup(task, body, onChange) {
  renderStrictHint(task, body);

  const grid = document.createElement('div');
  grid.className = 'dropdown-grid';

  task.items.forEach((item) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'dropdown-item';
    wrapper.dataset.itemId = item.id;
    wrapper.innerHTML = `
      <strong>${escapeHtml(item.label)}</strong>
      <select class="task-select" name="${escapeAttribute(item.id)}">
        <option value="">${escapeHtml(getPlaceholder(task))}</option>
        ${getDropdownOptions(task, item)
          .map((option) => `<option value="${escapeAttribute(option.id)}">${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    `;
    wrapper.querySelector('select').addEventListener('change', onChange);
    grid.append(wrapper);
  });

  body.append(grid);
}

function renderDragToSlots(task, body, onChange) {
  const board = document.createElement('div');
  board.className = 'dnd-board';
  board.innerHTML = `
    <div>
      <p class="task-description">Перетащите карточки в слоты. На телефоне: нажмите карточку, затем нужный слот.</p>
      <div class="dnd-bank" data-dnd-bank aria-label="Карточки для распределения"></div>
    </div>
    <div class="dnd-slots" aria-label="Слоты для ответов"></div>
  `;

  const bank = board.querySelector('[data-dnd-bank]');
  const slots = board.querySelector('.dnd-slots');

  task.cards.forEach((card) => {
    const cardElement = document.createElement('button');
    cardElement.type = 'button';
    cardElement.className = 'dnd-card';
    cardElement.draggable = true;
    cardElement.dataset.dndCard = '';
    cardElement.dataset.cardId = card.id;
    cardElement.textContent = card.label;
    bank.append(cardElement);
  });

  task.slots.forEach((slot) => {
    const slotElement = document.createElement('div');
    slotElement.className = 'dnd-slot';
    slotElement.dataset.dndSlot = '';
    slotElement.dataset.slotId = slot.id;
    slotElement.innerHTML = `<span class="slot-label">${escapeHtml(slot.label)}</span>`;
    slots.append(slotElement);
  });

  body.append(board);
  setupDragToSlots(board, onChange);
}

function readTaskAnswer(task, taskElement) {
  if (!taskElement) return getEmptyAnswer(task);

  switch (task.type) {
    case 'singleChoice':
      return taskElement.querySelector('input:checked')?.value ?? null;
    case 'multipleChoice':
      return Array.from(taskElement.querySelectorAll('input:checked')).map((input) => input.value);
    case 'dropdown':
      return taskElement.querySelector('select')?.value || null;
    case 'dropdownGroup':
      return Object.fromEntries(
        Array.from(taskElement.querySelectorAll('select')).map((select) => [select.name, select.value || null]),
      );
    case 'dragToSlots':
      return readDragAnswer(taskElement);
    default:
      return null;
  }
}

function isAnswered(task, answer) {
  switch (task.type) {
    case 'singleChoice':
      return Boolean(answer);
    case 'multipleChoice':
      return Array.isArray(answer) && answer.length > 0;
    case 'dropdown':
      return Boolean(answer);
    case 'dropdownGroup':
      return Object.values(answer ?? {}).every(Boolean);
    case 'dragToSlots':
      return Object.values(answer ?? {}).every(Boolean);
    default:
      return false;
  }
}

function markCorrectAnswers(taskElement, taskResult) {
  const correctAnswer = taskResult.correctAnswer;

  if (taskElement.dataset.taskType === 'singleChoice' || taskElement.dataset.taskType === 'multipleChoice') {
    const answerIds = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    answerIds.forEach((id) => {
      taskElement.querySelector(`[data-option-id="${CSS.escape(id)}"]`)?.classList.add('is-right-answer');
    });
    const answerText = taskResult.correctDisplay ?? taskResult.correctAnswerText ?? answerIds.join('; ');
    taskElement.insertAdjacentHTML('beforeend', `<div class="badge ok">Верно: ${escapeHtml(answerText)}</div>`);
    return;
  }

  if (taskElement.dataset.taskType === 'dropdown') {
    const select = taskElement.querySelector('select');
    const optionText = taskResult.correctDisplay ?? select?.querySelector(`option[value="${CSS.escape(correctAnswer)}"]`)?.textContent ?? correctAnswer;
    select?.closest('.dropdown-item')?.insertAdjacentHTML('beforeend', `<div class="badge ok">Верно: ${escapeHtml(optionText)}</div>`);
    return;
  }

  if (taskElement.dataset.taskType === 'dropdownGroup') {
    Object.entries(correctAnswer).forEach(([itemId, optionId]) => {
      const item = taskElement.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
      const select = item?.querySelector('select');
      const optionText = getDisplayForItem(taskResult.correctDisplay, itemId)
        ?? select?.querySelector(`option[value="${CSS.escape(optionId)}"]`)?.textContent
        ?? optionId;
      item?.insertAdjacentHTML('beforeend', `<div class="badge ok">Верно: ${escapeHtml(optionText)}</div>`);
    });
    return;
  }

  if (taskElement.dataset.taskType === 'dragToSlots') {
    taskElement.querySelectorAll('[data-dnd-slot]').forEach((slot) => {
      const slotId = slot.dataset.slotId;
      const expectedCard = getDisplayForItem(taskResult.correctDisplay, slotId) ?? correctAnswer[slotId];
      slot.insertAdjacentHTML('beforeend', `<div class="badge ok">Верно: ${escapeHtml(expectedCard)}</div>`);
    });
  }
}

function renderStrictHint(task, body) {
  if (!task.strictHint) return;

  const hint = document.createElement('p');
  hint.className = 'task-description';
  hint.textContent = task.strictHint;
  body.append(hint);
}

function getTaskParts(task) {
  return Array.isArray(task.parts) && task.parts.length > 0 ? task.parts : [task];
}

function getGradableTasks(variant) {
  return variant.tasks.flatMap((task) => getTaskParts(task));
}

function getEmptyAnswer(task) {
  if (task.type === 'multipleChoice') return [];
  if (task.type === 'dropdownGroup' || task.type === 'dragToSlots') return {};
  return null;
}

function getDisplayForItem(correctDisplay, itemId) {
  if (!correctDisplay || typeof correctDisplay !== 'object') return correctDisplay ?? null;
  return correctDisplay[itemId] ?? null;
}

function getDropdownOptions(task, item) {
  return item.options ?? task.optionsBySlot?.[item.id] ?? task.options ?? [];
}

function getPlaceholder(task) {
  return task.placeholder ?? 'Выберите ответ';
}

function statusClass(status) {
  return {
    correct: 'is-correct',
    partial: 'is-partial',
    wrong: 'is-wrong',
  }[status] ?? 'is-wrong';
}

function formatPoints(value) {
  if (value === 1) return 'балл';
  if (value >= 2 && value <= 4) return 'балла';
  return 'баллов';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
