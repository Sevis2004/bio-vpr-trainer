let selectedCard = null;

export function setupDragToSlots(root, onChange) {
  const cards = Array.from(root.querySelectorAll('[data-dnd-card]'));
  const slots = Array.from(root.querySelectorAll('[data-dnd-slot]'));
  const bank = root.querySelector('[data-dnd-bank]');

  cards.forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', card.dataset.cardId);
      event.dataTransfer.effectAllowed = 'move';
      selectCard(card, root);
    });

    card.addEventListener('dragend', () => {
      slots.forEach((slot) => slot.classList.remove('is-over'));
    });

    card.addEventListener('click', () => {
      selectCard(selectedCard === card ? null : card, root);
    });
  });

  [...slots, bank].filter(Boolean).forEach((target) => {
    target.addEventListener('dragover', (event) => {
      event.preventDefault();
      target.classList.add('is-over');
    });

    target.addEventListener('dragleave', () => {
      target.classList.remove('is-over');
    });

    target.addEventListener('drop', (event) => {
      event.preventDefault();
      target.classList.remove('is-over');
      const cardId = event.dataTransfer.getData('text/plain');
      const card = root.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`);
      if (card) {
        moveCard(card, target, root);
        onChange?.();
      }
    });

    target.addEventListener('click', (event) => {
      const clickedCard = event.target.closest('[data-dnd-card]');
      if (clickedCard || !selectedCard || !root.contains(selectedCard)) return;
      moveCard(selectedCard, target, root);
      selectCard(null, root);
      onChange?.();
    });
  });
}

export function readDragAnswer(root) {
  const answer = {};
  root.querySelectorAll('[data-dnd-slot]').forEach((slot) => {
    const card = slot.querySelector('[data-dnd-card]');
    answer[slot.dataset.slotId] = card?.dataset.cardId ?? null;
  });
  return answer;
}

function selectCard(card, root) {
  if (selectedCard && !root.contains(selectedCard)) {
    selectedCard = null;
  }
  root.querySelectorAll('[data-dnd-card]').forEach((item) => item.classList.remove('is-selected'));
  selectedCard = card;
  selectedCard?.classList.add('is-selected');
}

function moveCard(card, target, root) {
  if (target.matches('[data-dnd-slot]')) {
    const existingCard = target.querySelector('[data-dnd-card]');
    const previousParent = card.parentElement;
    if (existingCard && existingCard !== card) {
      previousParent.append(existingCard);
    }
  }
  target.append(card);
  selectCard(null, root);
}
