# Тестирование загрузчика страниц (JS)

[![hexlet-check](https://github.com/shkrobadasha/js-jest-testing-project-67/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/shkrobadasha/js-jest-testing-project-67/actions)

Загрузчик страниц – библиотека, которая умеет скачивать страницы по сети и сохранять их на локальном диске. Акцент в проекте делается на ее тестировании. Из-за обилия побочных эффектов, здесь придется правильно работать с их подавлением, стабами/моками и возможными ошибками.

Учебный проект Хекслета: https://ru.hexlet.io/programs/js-jest-testing
Как это должно работать: https://asciinema.org/a/LO5LY8HUHaUjH6zHoZo61Qkw1

## Стек

- JavaScript

## Установка

```bash
git clone https://github.com/shkrobadasha/js-jest-testing-project-67.git
cd js-jest-testing-project-67
npm install
```

## Использование

### CLI

```bash
bin/page-loader.js --output /var/tmp https://ru.hexlet.io/courses
# /var/tmp/ru-hexlet-io-courses.html
```

Опция `--output` (`-o`) задаёт директорию для сохранения файла. По умолчанию файл сохраняется в текущую директорию.

### Как библиотека

```js
import pageLoader from '@hexlet/code';

const { filepath } = await pageLoader('https://ru.hexlet.io/courses', '/var/tmp');
// '/var/tmp/ru-hexlet-io-courses.html'
```

### Тесты

```bash
npx vitest run
```

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
