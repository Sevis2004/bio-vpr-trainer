import { readDragAnswer, setupDragToSlots } from './dnd.js';

export function renderVariant(variant, container, onChange) {
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  getTaskGroups(variant).forEach((group) => {
    const groupNumber = getTaskGroupNumber(group[0]);
    const card = document.createElement('article');
    card.className = 'task-card';
    card.dataset.taskNo = groupNumber;
    card.innerHTML = `
      <div class="task-head">
        <div class="task-number">Задание ${escapeHtml(groupNumber)}</div>
      </div>
    `;

    group.forEach((task) => {
      const part = document.createElement('section');
      part.className = 'task-part';
      part.dataset.taskId = task.id;
      part.dataset.taskType = task.type;
      part.innerHTML = `
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-body"></div>
      `;

      const body = part.querySelector('.task-body');
      renderTaskBody(task, body, onChange);
      card.append(part);
    });

    fragment.append(card);
  });

  container.append(fragment);
}

export function readAnswers(variant, container) {
  return Object.fromEntries(
    variant.tasks.map((task) => {
      const part = container.querySelector(`.task-part[data-task-id="${CSS.escape(task.id)}"]`);
      return [task.id, readTaskAnswer(task, part)];
    }),
  );
}

export function countCompletedTaskGroups(variant, container) {
  const answers = readAnswers(variant, container);
  return getTaskGroups(variant).filter((group) => group.every((task) => isAnswered(task, answers[task.id]))).length;
}

export function countTaskGroups(variant) {
  return getTaskGroups(variant).length;
}

export function applyResults(container, result) {
  clearResults(container);

  result.taskResults.forEach((taskResult) => {
    const part = container.querySelector(`.task-part[data-task-id="${CSS.escape(taskResult.taskId)}"]`);
    if (!part) return;

    part.classList.add(statusClass(taskResult.status));
    part.querySelectorAll('input, select, button').forEach((control) => {
      control.disabled = true;
    });

    markCorrectAnswers(part, taskResult);
  });
}

export function clearResults(container) {
  container.querySelectorAll('.task-card, .task-part').forEach((element) => {
    element.classList.remove('is-correct', 'is-partial', 'is-wrong');
    element.querySelectorAll('input, select, button').forEach((control) => {
      control.disabled = false;
    });
  });

  container.querySelectorAll('.is-right-answer').forEach((element) => {
    element.classList.remove('is-right-answer');
  });
  container.querySelectorAll('.correct-answer-summary, .answer-badge').forEach((element) => {
    element.remove();
  });
}

function getTaskGroups(variant) {
  const groupsByNumber = new Map();

  variant.tasks.forEach((task) => {
    const groupNumber = getTaskGroupNumber(task);
    if (!groupsByNumber.has(groupNumber)) {
      groupsByNumber.set(groupNumber, []);
    }
    groupsByNumber.get(groupNumber).push(task);
  });

  return [...groupsByNumber.values()];
}

function getTaskGroupNumber(task) {
  if (task.taskNo !== undefined && task.taskNo !== null && String(task.taskNo).trim() !== '') {
    return String(task.taskNo).trim();
  }

  const id = String(task.id ?? '').trim();
  const leadingNumber = id.match(/^\d+/)?.[0];
  if (leadingNumber) return stripLeadingZeroes(leadingNumber);

  const embeddedNumber = id.match(/\d+/)?.[0];
  return embeddedNumber ? stripLeadingZeroes(embeddedNumber) : id;
}

function stripLeadingZeroes(value) {
  return String(Number(value)) || value;
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
      body.innerHTML = '<div class="empty-state">Неизвестный тип задания.</div>';
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
      ${item.strictHint ? `<p class="task-description">${escapeHtml(item.strictHint)}</p>` : ''}
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

function readTaskAnswer(task, part) {
  if (!part) return null;

  switch (task.type) {
    case 'singleChoice':
      return part.querySelector('input:checked')?.value ?? null;
    case 'multipleChoice':
      return Array.from(part.querySelectorAll('input:checked')).map((input) => input.value);
    case 'dropdown':
      return part.querySelector('select')?.value || null;
    case 'dropdownGroup':
      return Object.fromEntries(
        Array.from(part.querySelectorAll('select')).map((select) => [select.name, select.value || null]),
      );
    case 'dragToSlots':
      return readDragAnswer(part);
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

function markCorrectAnswers(part, taskResult) {
  const correctAnswer = taskResult.correctAnswer;

  appendResultSummary(part, taskResult);

  if (part.dataset.taskType === 'singleChoice' || part.dataset.taskType === 'multipleChoice') {
    const answerIds = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    answerIds.forEach((id) => {
      part.querySelector(`[data-option-id="${CSS.escape(id)}"]`)?.classList.add('is-right-answer');
    });
  }
}

function appendResultSummary(part, taskResult) {
  const summary = document.createElement('div');
  summary.className = 'correct-answer-summary';
  summary.innerHTML = `
    <div>${renderResultBadge(taskResult)}</div>
    ${
      taskResult.correctAnswerText
        ? `<div class="correct-answer-text">Правильный ответ: ${escapeHtml(taskResult.correctAnswerText)}</div>`
        : ''
    }
  `;
  part.append(summary);
}

function renderResultBadge(taskResult) {
  const statusMap = {
    correct: ['ok', 'Верно'],
    partial: ['partial', 'Частично верно'],
    wrong: ['bad', 'Неверно'],
  };
  const [className, label] = statusMap[taskResult.status] ?? statusMap.wrong;
  return `<span class="badge ${className} answer-badge">${escapeHtml(label)}</span>`;
}

function renderStrictHint(task, body) {
  if (!task.strictHint) return;

  const hint = document.createElement('p');
  hint.className = 'task-description';
  hint.textContent = task.strictHint;
  body.append(hint);
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
