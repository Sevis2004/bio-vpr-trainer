import { gradeVariant } from './grader.js';
import { applyResults, clearResults, countAnsweredTasks, readAnswers, renderVariant } from './renderer.js';
import { clearResultsPanel, renderResults } from './results.js';

const state = {
  variantsIndex: [],
  currentVariant: null,
  checked: false,
};

const elements = {
  variantSelect: document.querySelector('#variantSelect'),
  progressText: document.querySelector('#progressText'),
  progressBar: document.querySelector('#progressBar'),
  statusLine: document.querySelector('#statusLine'),
  tasks: document.querySelector('#tasks'),
  results: document.querySelector('#results'),
  checkBtn: document.querySelector('#checkBtn'),
  resetBtn: document.querySelector('#resetBtn'),
};

init().catch((error) => {
  console.error(error);
  setStatus('Не удалось загрузить варианты. Откройте сайт через локальный сервер, а не через file://.');
});

async function init() {
  state.variantsIndex = await fetchJson('data/variants/index.json');
  renderVariantSelect(state.variantsIndex);
  bindEvents();

  if (state.variantsIndex.length === 0) {
    setStatus('В data/variants/index.json пока нет вариантов.');
    return;
  }

  await loadVariant(state.variantsIndex[0].id);
}

function bindEvents() {
  elements.variantSelect.addEventListener('change', async (event) => {
    await loadVariant(event.target.value);
  });

  elements.checkBtn.addEventListener('click', () => {
    if (!state.currentVariant) return;

    const answers = readAnswers(state.currentVariant, elements.tasks);
    const result = gradeVariant(state.currentVariant, answers);
    state.checked = true;
    applyResults(elements.tasks, result);
    renderResults(result, elements.results);
    updateProgress();
    setStatus('Проверка завершена. Правильные ответы показаны в заданиях и таблице ошибок.');
    elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.resetBtn.addEventListener('click', () => {
    if (!state.currentVariant) return;
    loadVariant(state.currentVariant.id);
  });
}

async function loadVariant(variantId) {
  const item = state.variantsIndex.find((variant) => variant.id === variantId);
  if (!item) return;

  setStatus('Загрузка варианта…');
  clearResultsPanel(elements.results);
  clearResults(elements.tasks);

  const variant = await fetchJson(item.file);
  validateVariant(variant);
  state.currentVariant = variant;
  state.checked = false;
  elements.variantSelect.value = variantId;
  document.title = `${variant.title} — тренажёр ВПР/МЦКО`;

  renderVariant(variant, elements.tasks, () => {
    if (state.checked) return;
    updateProgress();
  });
  updateProgress();
  setStatus(`${variant.title}: ${variant.tasks.length} заданий, максимум ${variant.maxScore} балла.`);
}

function renderVariantSelect(variants) {
  elements.variantSelect.innerHTML = variants
    .map((variant) => `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.title)}</option>`)
    .join('');
}

function updateProgress() {
  if (!state.currentVariant) {
    elements.progressText.textContent = '0 из 0';
    elements.progressBar.value = 0;
    return;
  }

  const answered = countAnsweredTasks(state.currentVariant, elements.tasks);
  const total = state.currentVariant.tasks.length;
  elements.progressText.textContent = `${answered} из ${total}`;
  elements.progressBar.value = total > 0 ? Math.round((answered / total) * 100) : 0;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

function validateVariant(variant) {
  const tasksScore = variant.tasks.reduce((sum, task) => sum + task.maxScore, 0);
  if (tasksScore !== variant.maxScore) {
    console.warn(`Сумма баллов заданий (${tasksScore}) не равна maxScore варианта (${variant.maxScore}).`);
  }
}

function setStatus(message) {
  elements.statusLine.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
