export function renderResults(result, container) {
  const rows = result.taskResults
    .filter((task) => task.status !== 'correct')
    .map((task) => renderErrorRow(task))
    .join('');

  container.hidden = false;
  container.innerHTML = `
    <h2>Результаты проверки</h2>
    <div class="score-grid">
      <div class="score-card">
        <span>Баллы</span>
        <strong>${result.score} из ${result.maxScore}</strong>
      </div>
      <div class="score-card">
        <span>Процент</span>
        <strong>${result.percent}%</strong>
      </div>
      <div class="score-card">
        <span>Оценка</span>
        <strong>${result.mark}</strong>
      </div>
    </div>
    <h3>Список ошибок</h3>
    ${
      rows
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№ задания</th>
                  <th>Балл</th>
                  <th>Максимум</th>
                  <th>Статус</th>
                  <th>Правильный ответ</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
        : '<div class="empty-state">Ошибок нет — все задания выполнены верно.</div>'
    }
  `;
}

export function clearResultsPanel(container) {
  container.hidden = true;
  container.innerHTML = '';
}

function renderErrorRow(task) {
  return `
    <tr>
      <td>${task.number}</td>
      <td>${task.score}</td>
      <td>${task.maxScore}</td>
      <td>${renderStatus(task.status)}</td>
      <td>${escapeHtml(task.correctAnswerText)}</td>
    </tr>
  `;
}

function renderStatus(status) {
  const statusMap = {
    correct: ['ok', 'Верно'],
    partial: ['partial', 'Частично верно'],
    wrong: ['bad', 'Ошибка'],
  };
  const [className, label] = statusMap[status] ?? statusMap.wrong;
  return `<span class="badge ${className}">${label}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
