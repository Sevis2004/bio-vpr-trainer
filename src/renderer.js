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

    renderTaskGroupMeta(variant.groupMeta?.[groupNumber], card);

    group.forEach((task) => {
      const part = document.createElement('section');
      part.className = 'task-part';
      part.dataset.taskId = task.id;
      part.dataset.taskType = task.type;
      part.innerHTML = `<h3 class="${task.titleAlign === 'center' ? 'text-center' : ''}">${escapeHtml(task.title ?? '')}</h3>`;
      renderTaskContent(task, part, onChange);
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

function renderTaskContent(task, part, onChange) {
  renderTables(task.tables, part);

  if (task.layout === 'introMediaRow') {
    const introLayout = document.createElement('div');
    introLayout.className = 'task-intro-media-layout';

    const introText = document.createElement('div');
    introText.className = 'task-intro-text';
    appendDescription(task.description, introText, task.descriptionAlign);
    introLayout.append(introText);

    renderMedia(task.media ?? task.image, introLayout, 'task-media task-media-side');
    part.append(introLayout);

    const body = document.createElement('div');
    body.className = 'task-body';
    part.append(body);
    renderTaskBody(task, body, onChange);
    return;
  }

  if (task.layout === 'mediaBodyRow') {
    const row = document.createElement('div');
    row.className = 'task-media-body-layout';
    renderMedia(task.media ?? task.image, row, 'task-media task-media-side');

    const content = document.createElement('div');
    content.className = 'task-media-body-content';
    appendDescription(task.description, content, task.descriptionAlign);
    renderTaskBody(task, content, onChange);
    row.append(content);
    part.append(row);
    return;
  }

  if (!(task.type === 'dragToSlots' && task.layout === 'imageDnd')) {
    renderMedia(task.media ?? task.image, part, 'task-media');
  }
  appendDescription(task.description, part, task.descriptionAlign);

  const body = document.createElement('div');
  body.className = 'task-body';
  part.append(body);
  renderTaskBody(task, body, onChange);
}

function appendDescription(text, container, align) {
  if (!text) return;

  const description = document.createElement('p');
  description.className = `task-description${align === 'center' ? ' text-center' : ''}`;
  description.style.whiteSpace = 'pre-line';
  description.textContent = text;
  container.append(description);
}

function renderTaskGroupMeta(groupMeta, card) {
  if (!groupMeta?.description && !groupMeta?.tables && !groupMeta?.image && !groupMeta?.media) return;

  const intro = document.createElement('div');
  intro.className = 'task-group-intro';

  appendDescription(groupMeta.description, intro, groupMeta.descriptionAlign);

  renderTables(groupMeta.tables, intro);
  renderMedia(groupMeta.media ?? groupMeta.image, intro, 'task-group-media', groupMeta.imageAlt);

  card.append(intro);
}

function renderTables(tables, container) {
  const tableItems = normalizeTables(tables);
  if (tableItems.length === 0) return;

  tableItems.forEach((tableData) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'task-table-wrapper';
    wrapper.style.overflowX = 'auto';
    wrapper.style.maxWidth = '100%';

    const table = document.createElement('table');
    table.className = 'task-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    if (tableData.caption) {
      const caption = document.createElement('caption');
      caption.textContent = tableData.caption;
      table.append(caption);
    }

    if (Array.isArray(tableData.headers) && tableData.headers.length > 0) {
      const thead = document.createElement('thead');
      const row = document.createElement('tr');
      tableData.headers.forEach((header) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = header;
        applyTableCellStyles(cell, { isHeader: true });
        row.append(cell);
      });
      thead.append(row);
      table.append(thead);
    }

    const tbody = document.createElement('tbody');
    tableData.rows.forEach((rowData) => {
      const row = document.createElement('tr');
      rowData.forEach((value, cellIndex) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        applyTableCellStyles(cell, { center: tableData.centerBodyExceptFirst && cellIndex > 0 });
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(tbody);

    wrapper.append(table);
    container.append(wrapper);
  });
}

function normalizeTables(tables) {
  if (!tables) return [];
  const tableItems = Array.isArray(tables) ? tables : [tables];

  return tableItems.filter((table) => Array.isArray(table?.rows));
}

function applyTableCellStyles(cell, options = {}) {
  cell.style.border = '1px solid var(--border, #d0d7de)';
  cell.style.padding = '0.5rem';
  cell.style.textAlign = options.isHeader || options.center ? 'center' : 'left';
}

function renderMedia(media, container, className, fallbackAlt = '') {
  const mediaItems = normalizeMedia(media, fallbackAlt);
  if (mediaItems.length === 0) return;

  const wrapper = document.createElement('div');
  wrapper.className = [className, getMediaLayoutClass(mediaItems)].filter(Boolean).join(' ');

  mediaItems.forEach((item) => {
    const figure = document.createElement('figure');
    figure.className = ['media-figure', getMediaSizeClass(item), getMediaAlignClass(item)].filter(Boolean).join(' ');

    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt ?? '';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      figure.hidden = true;
    });
    figure.append(image);

    if (item.caption) {
      const caption = document.createElement('figcaption');
      caption.textContent = item.caption;
      figure.append(caption);
    }

    wrapper.append(figure);
  });

  const groupCaption = getMediaGroupCaption(media);
  if (groupCaption) {
    const caption = document.createElement('div');
    caption.className = 'media-group-caption';
    caption.textContent = groupCaption;
    wrapper.append(caption);
  }

  container.append(wrapper);
}

function getMediaGroupCaption(media) {
  return !Array.isArray(media) && typeof media === 'object' ? media.groupCaption : '';
}

function normalizeMedia(media, fallbackAlt = '') {
  if (!media) return [];
  if (typeof media === 'string') {
    return [{ src: media, alt: fallbackAlt }];
  }
  if (!Array.isArray(media)) {
    if (Array.isArray(media.items)) {
      return media.items
        .map((item) => (typeof item === 'string' ? { src: item, alt: fallbackAlt } : { ...item, layout: item.layout ?? media.layout }))
        .filter((item) => item?.src);
    }
    return media.src ? [media] : [];
  }

  return media
    .map((item) => (typeof item === 'string' ? { src: item, alt: fallbackAlt } : item))
    .filter((item) => item?.src);
}

function getMediaLayoutClass(mediaItems) {
  const layout = mediaItems.find((item) => item.layout)?.layout;
  return layout ? `media-layout-${layout}` : '';
}

function getMediaSizeClass(item) {
  const size = item.size ?? item.displaySize;
  return size ? `media-${size}` : '';
}

function getMediaAlignClass(item) {
  return item.align ? `media-align-${item.align}` : '';
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
      ${renderMediaMarkup(item.media)}
      <strong>${escapeHtml(item.question ?? item.label)}</strong>
      ${item.helpText ? `<p class="task-description">${escapeHtml(item.helpText)}</p>` : ''}
      ${item.strictHint ? `<p class="task-description">${escapeHtml(item.strictHint)}</p>` : ''}
      <select class="task-select" name="${escapeAttribute(item.id)}">
        <option value="">${escapeHtml(getPlaceholder(item, task))}</option>
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

function renderMediaMarkup(media) {
  return normalizeMedia(media)
    .map((item) => {
      const classes = ['media-figure', getMediaSizeClass(item), getMediaAlignClass(item)].filter(Boolean).join(' ');
      return `
        <figure class="${escapeAttribute(classes)}">
          <img src="${escapeAttribute(item.src)}" alt="${escapeAttribute(item.alt ?? '')}" loading="lazy" />
          ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
        </figure>
      `;
    })
    .join('');
}

function renderDragToSlots(task, body, onChange) {
  const board = document.createElement('div');
  board.className = `dnd-board${task.layout === 'imageDnd' ? ' image-dnd-layout plant-label-layout' : ''}`;

  if (task.layout === 'imageDnd') {
    const imageColumn = document.createElement('div');
    imageColumn.className = 'image-dnd-media';
    renderMedia(task.media ?? task.image, imageColumn, 'task-media');
    board.append(imageColumn);
  }

  const controls = document.createElement('div');
  controls.className = 'dnd-controls';
  controls.innerHTML = `
    <p class="task-description">Перетащите карточки в слоты. На телефоне: нажмите карточку, затем нужный слот.</p>
    <div class="dnd-bank" data-dnd-bank aria-label="Карточки для распределения"></div>
  `;

  const slots = document.createElement('div');
  slots.className = 'dnd-slots';
  slots.setAttribute('aria-label', 'Слоты для ответов');

  if (task.layout === 'imageDnd') {
    board.append(slots, controls);
  } else {
    board.append(controls, slots);
  }

  const bank = board.querySelector('[data-dnd-bank]');

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

function getPlaceholder(target, parentTask = null) {
  const strictSource = isStrictSelect(target) ? target : isStrictSelect(parentTask) ? parentTask : null;
  if (strictSource) {
    return getStrictPlaceholder(strictSource, parentTask);
  }

  return target?.neutralPlaceholder ?? parentTask?.neutralPlaceholder ?? 'Выберите ответ';
}

function getStrictPlaceholder(strictSource, parentTask) {
  if (strictSource.placeholder) return strictSource.placeholder;
  if (isStrictPlaceholder(parentTask?.placeholder)) return parentTask.placeholder;
  return '— сначала подумай сам, затем выбери —';
}

function isStrictSelect(item) {
  return Boolean(item?.strictHint || item?.strictMode);
}

function isStrictPlaceholder(placeholder) {
  return typeof placeholder === 'string' && placeholder.includes('сначала подумай сам');
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
