# Handover для кодера: Результаты аудита CP-DASHBOARD-AUDIT-01

**Назначение документа:** техническое задание и ревью для кодера/агента на исправление подтверждённых дефектов Portfolio Dashboard.  
**Целевой репозиторий:** `Murkin1980/salamat-projects-dashboard`  
**Базовый статус продакшна:** Cloudflare Pages `projects.salamat-mebel.kz` (коммит `6a2cd09`)  
**Текущая ветка разработки:** `main` (отставание продакшна из-за сбоя деплоя `c26ae63`)  
**Ограничения:** MPE Scope & Change Control, минимальный диффуз, строгий мониторинг-онли (без кнопок запуска и исполнительного кода).

---

## 1. Что уже делает Codex (НЕ ДУБЛИРОВАТЬ!)

Перед началом работы учти активные ветки и PR Codex/Arena, чтобы не делать двойную работу:

1. **PR #35 (`fix/portfolio-freshness-audit-20261012`):**
   - Файл: `scripts/report-portfolio-freshness.mjs`
   - Задача: диагностика устаревших проектов и пробелов покрытия источников в CI-пайплайне.
   - **Запрещено:** писать альтернативные скрипты аудита свежести.
2. **Ветка `origin/fix/cp13-sync-fallback-deploy`:**
   - Задача: безопасный фоллбэк снапшота при сбое синхронизации с GitHub (ошибки 403 Forbidden на приватных репозиториях).
   - **Запрещено:** менять логику обработки ошибок приватных репозиториев до интеграции этой ветки.
3. **PR #31 (`aa150e8`, `docs/UI_SKILLS_EXPERIMENT.md`):**
   - Задача: перенос длинных строк (`overflow-wrap: anywhere`) и тач-таргеты 44px на мобильных устройствах.
   - Базовый рендеринг контента на 390px уже нормализован (`docWidth == 390px`).

---

## 2. Задачи к реализации (по приоритетам)

### Задача 1 (UI/UX, Высокий): Автоскролл и видимость активного таба на мобильных
- **Файлы:** `src/components/DashboardApp.tsx`, `src/styles.css`
- **Проблема:** На экранах 390px меню `.nav-list` отображает только первую кнопку `Triage`. При переходе на другие экраны (`#portfolio`, `#attention`, `#project/...`) активный таб остаётся за правым краем экрана (`scrollLeft = 0`), вводя пользователя в заблуждение, будто открыт Триаж.
- **Решение:**
  1. В `src/components/DashboardApp.tsx` привязать `ref` к контейнеру навигации и кнопке активного таба.
  2. Добавить `useEffect` при смене `view`: вызывать `activeTabRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })`.
  3. В `src/styles.css` для `.nav-list` на экранах `@media (max-width: 760px)` добавить визуальный градиентный намёк на скролл (scroll-shadow / fade indicator справа), чтобы было очевидно наличие скрытых пунктов.

---

### Задача 2 (UI/UX, Средний): Устранение висячей точки и некорректного переноса в карточках
- **Файлы:** `src/styles.css`, `src/components/ProjectCard.tsx` (или соответствующий компонент карточки)
- **Проблема:** В футере карточки проекта разделитель `·` перед SHA коммита или ссылкой на `PROJECT_STATUS.md` переносится на новую строку в одиночестве, образуя «сиротливый символ» в начале строки.
- **Решение:**
  1. Обернуть разделитель и следующий за ним токен источника в неразрывный контейнер:
     ```html
     <span class="project-source-provenance">
       <span aria-hidden="true">·</span>
       <code>{sourceId}</code>
     </span>
     ```
  2. Добавить CSS:
     ```css
     .project-source-provenance {
       display: inline-flex;
       align-items: center;
       gap: 4px;
       white-space: nowrap;
     }
     ```

---

### Задача 3 (Data / Parser, Средний): Парсинг чекпоинтов и этапов в GitHub Source Adapter
- **Файлы:** `src/adapters/github-source.ts`, `tests/github-source-adapter.test.ts`
- **Проблема:** Для проекта `salamat-projects-dashboard` в детальном виде отображается `ТЕКУЩИЙ ЭТАП: Не определено источником`, хотя в его `PROJECT_STATUS.md` есть строка `Current checkpoint: CP-17 — Live History & Reports`. Регулярное выражение адаптера ожидает только `Stage:` или `Current stage:`.
- **Решение:**
  1. В функции парсинга `extractStageAndNextAction` (или аналогичной) в `src/adapters/github-source.ts` поддержать паттерны:
     - `/^Current checkpoint:\s*(.+)$/im`
     - `/^Checkpoint:\s*(.+)$/im`
  2. Написать юнит-тест в `tests/github-source-adapter.test.ts`, подтверждающий извлечение чекпоинта как этапа.

---

### Задача 4 (CI/CD, Критический): Устранение сбоя деплоя в Cloudflare Pages
- **Файлы:** `.github/workflows/deploy-cloudflare-pages.yml`
- **Проблема:** Коммит `c26ae63` завершился со статусом `Failure` в шаге публикации Cloudflare Pages. Продакшн застрял на коммите `6a2cd09` и не обновляется.
- **Действия кодера:**
  1. Проверить логи последнего упавшего GitHub Actions run для коммита `c26ae63`.
  2. Проверить шаг `Verify production snapshot`: при деплое Cloudflare Pages кэш на эджах может отдавать старый `project-state.json` дольше, чем 12 попыток по 10 секунд. Добавить `cache-busting` заголовок или `curl -H 'Cache-Control: no-cache'`.
  3. Убедиться, что `npx wrangler pages deploy dist` не падает из-за лимита файлов или авторизации.

---

### Задача 5 (Data Quality, Подготовка к CP-19): Фиксация статусов и GAP
- **Файлы:** `config/source-repositories.json`, `docs/CHECKPOINTS.md`
- **Контекст:** Сейчас 8 репозиториев находятся в `gaps` (5 приватных возвращают 403 Forbidden, 3 не имеют `PROJECT_STATUS.md`).
- **Требование:**
  1. Не удалять и не скрывать проекты из портфеля.
  2. Убедиться, что для каждого gap-проекта указана внятная причина в `config/source-repositories.json`.
  3. Владелец должен добавить токен `GH_TOKEN` с доступом к приватным репозиториям организации, либо утвердить фиксацию текущего snapshot в рамках чекпоинта **CP-19**.

---

## 3. Критерии приёмки (Definition of Done)

- [ ] Все существующие тесты проходят: `npm test` (на ветке `main` ожидается 267/267 тестов).
- [ ] Сборка TypeScript и Vite завершается без ошибок: `npm run build`.
- [ ] Проверка границ мониторинга успешна: `npm run verify:snapshot` и тесты `dashboard-monitoring-boundary.test.ts`.
- [ ] Мобильная навигация на разрешении 390×844 плавно скроллит активный таб в центр видимой области при переходе между экранами.
- [ ] В карточках проектов отсутствуют висячие символы `·` и разрывы строк.
- [ ] Деплой на Cloudflare Pages завершается со статусом `Success`, а production snapshot совпадает с коммитом.
