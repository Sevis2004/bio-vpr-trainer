# bio-vpr-trainer

MVP статического web-тренажёра по биологии 6 класса в стиле ВПР/МЦКО. Ученик выбирает вариант, отвечает на 16 заданий и получает баллы, процент, оценку, список ошибок и правильные ответы.

## Что внутри

```text
index.html
src/app.js
src/renderer.js
src/grader.js
src/dnd.js
src/results.js
data/variants/index.json
data/variants/bio6_demo_2026.json
assets/bio6_demo_2026/
```

Проект не использует backend, базу данных, авторизацию, OCR, PDF-парсер, npm и build step. Всё работает на plain HTML/CSS/JavaScript, а варианты лежат в JSON.

## 1. Как открыть локально

Из-за загрузки JSON через `fetch` сайт лучше открывать через простой локальный HTTP-сервер, а не двойным кликом по `index.html`.

Вариант с Python:

```bash
python3 -m http.server 8000
```

Затем откройте в браузере:

```text
http://localhost:8000/
```

Если у вас другой статический сервер, можно использовать его: достаточно отдать корень репозитория как статический сайт.

## 2. Как добавить новый вариант

Новый вариант добавляется без правки HTML и JavaScript.

1. Создайте JSON-файл в `data/variants/`, например:

   ```text
   data/variants/bio6_variant_02.json
   ```

2. Добавьте запись в `data/variants/index.json`:

   ```json
   {
     "id": "bio6_variant_02",
     "title": "Вариант 2",
     "file": "data/variants/bio6_variant_02.json"
   }
   ```

3. Внутри JSON-варианта задайте:
   - `id` — уникальный идентификатор;
   - `title` — название варианта;
   - `maxScore` — максимум, для MVP используется `42`;
   - `gradeScale` — шкала оценивания;
   - `tasks` — массив заданий.

Поддерживаемые типы заданий:

- `singleChoice` — один ответ через radio buttons;
- `multipleChoice` — несколько ответов через checkboxes;
- `dropdownGroup` — несколько выпадающих списков в одном задании;
- `dragToSlots` — перетаскивание карточек в слоты с fallback «клик по карточке → клик по слоту».

### Пример singleChoice

```json
{
  "id": "task_01",
  "type": "singleChoice",
  "title": "Орган растения",
  "description": "Какой орган поглощает воду из почвы?",
  "maxScore": 2,
  "options": [
    { "id": "leaf", "label": "Лист" },
    { "id": "root", "label": "Корень" }
  ],
  "answer": "root"
}
```

### Пример dragToSlots

```json
{
  "id": "task_16",
  "type": "dragToSlots",
  "title": "Распределение организмов",
  "maxScore": 7,
  "cards": [
    { "id": "moss", "label": "Кукушкин лён" },
    { "id": "pine", "label": "Сосна" }
  ],
  "slots": [
    { "id": "slot_moss", "label": "Мох" },
    { "id": "slot_gymnosperm", "label": "Голосеменное" }
  ],
  "answer": {
    "slot_moss": "moss",
    "slot_gymnosperm": "pine"
  },
  "scoreMap": { "0": 0, "1": 3, "2": 7 }
}
```

## 3. Как добавить картинки

Для каждого варианта можно создать отдельную папку в `assets/`, например:

```text
assets/bio6_variant_02/
```

Положите туда изображения:

```text
assets/bio6_variant_02/leaf.png
assets/bio6_variant_02/root.png
```

В текущем MVP задания используют текстовые карточки и подписи. Если нужно добавить изображение в текст варианта, рекомендуемый путь — расширить JSON задания полем вроде `image` или `cards[].image` и доработать `src/renderer.js`, чтобы он выводил `<img>` для этого поля. Так структура останется data-driven: HTML менять не понадобится.

## 4. Как выложить на static hosting

Подойдёт любой статический хостинг:

- GitHub Pages;
- Netlify;
- Vercel Static Deploy;
- Cloudflare Pages;
- любой nginx/S3-compatible hosting.

Что нужно сделать:

1. Загрузить весь репозиторий на хостинг.
2. Указать корень проекта как publish directory.
3. Убедиться, что JSON-файлы из `data/variants/` отдаются как статические файлы.
4. Открыть публичный URL и проверить загрузку варианта.

Build command не нужен.

## 5. Куда вставить код Яндекс.Метрики

В `index.html` уже есть placeholder:

```html
<!-- Yandex.Metrica counter placeholder -->
<!-- Paste counter script here before deployment -->
```

Вставьте код счётчика Яндекс.Метрики на место этих комментариев перед публикацией.

## Оценивание в MVP

Максимум за демонстрационный вариант — `42` балла.

Шкала:

- `0–10` = оценка `2`;
- `11–22` = оценка `3`;
- `23–34` = оценка `4`;
- `35–42` = оценка `5`.

Логика проверки находится в `src/grader.js`:

- `exact` для `singleChoice`;
- `set` для `multipleChoice`;
- `partialByErrors` для `dropdownGroup`:
  - 0 ошибок = `maxScore`;
  - 1 ошибка = `partialScore`;
  - 2+ ошибки = `0`;
- `dragByCorrectCount` для `dragToSlots`, где баллы задаются через `scoreMap` в JSON.
