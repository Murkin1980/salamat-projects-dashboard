# CP-DASHBOARD-AUDIT-01 — Portfolio Dashboard Audit Report

**Проект:** salamat-projects-dashboard  
**URL:** [https://projects.salamat-mebel.kz](https://projects.salamat-mebel.kz)  
**Режим:** READ-ONLY AUDIT  
**Дата аудита:** 14 октября 2026 г.  
**Версия snapshot:** `schemaVersion 1.2.0`, `version 6`, `updatedAt: 2026-10-14` (Cloudflare Pages deploy commit `6a2cd09`)

---

## 1. Резюме аудита: WARNING

Общий статус аудита: **WARNING** (Условно-работоспособно с критическими ограничениями).

- **Архитектурный инвариант соблюдён (PASS):** Дашборд остаётся строго read-only UI мониторинга. Никаких элементов исполнения (кнопок Continue, генерации Task Packet, интеграций Codex/Arena) в интерфейсе нет. Инварианты `FOUNDATION.md` и границы CP-10 не нарушены.
- **Инфраструктура и доступность (PASS):** Сайт `https://projects.salamat-mebel.kz` доступен по HTTPS (HTTP 200), TLS-сертификат валиден, React 19 SPA рендерится без критических фатальных ошибок в консоли.
- **Актуальность данных и синхронизация (WARNING / DEGRADED):** 14 из 15 проектов (93.3%) помечены как `УСТАРЕЛА` (>7 дней без подтверждённого обновления). Данные датируются концом августа и серединой сентября 2026 года (26–49 дней назад). 5 проектов остаются статическими фикстурами от 26.08.2026 без репозиториев (`repo: null`). Из 10 репозиториев синхронизируются только 2, остальные 8 находятся в `gaps` из-за ограничений токена (403 Forbidden на приватных репозиториях) или отсутствия канонических документов статуса.
- **Проценты готовности (WARNING / GAP):** 15 из 15 проектов (100%) имеют `progress: null`. Ни для одного проекта нет индикатора или процента готовности.
- **Мобильный UI/UX и навигация (WARNING):** Верхнее горизонтальное меню навигации (`.nav-list`) на экранах 390px показывает только кнопку `Triage`; остальные 7 вкладок скрыты за правой границей без визуального индикатора прокрутки. При переходе на другие экраны (`#portfolio`, `#project/...`) навигационная панель не прокручивается к активному элементу, дезориентируя пользователя.
- **Пайплайн развёртывания (WARNING):** Последние сборки в ветке `main` (коммит `c26ae63` и др.) завершились с ошибкой деплоя в Cloudflare Pages (`Failure`). Продакшн отстаёт от `origin/main` и зафиксирован на коммите `6a2cd09` от 10–12 октября 2026 г.

---

## 2. Подтверждённые проблемы

### Группа A. Данные и синхронизация
1. **Тотальная потеря свежести (Staleness):** 
   - 14 из 15 проектов имеют статус давностью более 26–49 дней.
   - В виджете Attention отображается: `ТРЕБУЮТ ВНИМАНИЯ: 15 (с объяснимой причиной)` — 100% проектов находятся в Attention исключительно из-за устаревания и отсутствия подтверждённого обновления статуса.
2. **Отсутствие процентов готовности (`progress: null`):** 
   - 100% проектов (15 из 15) имеют `progress: null`. Инвариант «никакого фейкового прогресса» соблюдён, однако реальный прогресс ни из одного репозитория не считывается и не отображается.
3. **Фикстурные проекты без репозиториев:**
   - 5 проектов (`mebelflow-ai`, `interactive-kp`, `mebellegal-kz`, `whatsapp-sales-agent`, `etsy-market-research`) остаются неизменными фикстурами от 26.08.2026 (`kind: FIXTURE`, `repo: null`).
4. **Неполная синхронизация источников (Source Coverage Gaps):**
   - В `config/source-repositories.json` активными источниками являются только 2 проекта: `salamat-projects-dashboard` и `murat-project-engineer`.
   - В `murat-project-engineer` файл `STATUS.md` не содержит канонической строки `Status:`, поэтому статус определяется как `UNKNOWN`.
   - 8 репозиториев перенесены в `gaps`:
     - `business-discovery`, `ai-microtask-factory`, `murat-house`, `murat-ai-orchestrator`, `grand-mebel-document-control` — приватные репозитории, возвращающие 403 Forbidden при синхронизации через стандартный токен GitHub Actions.
     - `murat-ads-control`, `tender-assistant`, `minibase-cloudflare` — репозитории без файлов `PROJECT_STATUS.md` / `STATUS.md`.
5. **Недоступность Cloudflare Discovery Analytics:**
   - Раздел `/discovery` отображает: `Discovery data unavailable: zone salamat-mebel.kz not visible to this token; Zone Read / Analytics Read may be missing`. Токен Cloudflare по-прежнему не имеет прав на чтение GraphQL Analytics зоны.
6. **Сбой автоматического деплоя в Cloudflare Pages:**
   - Деплой коммита `c26ae63` в ветке `main` упал с ошибкой `Failure` в Wrangler/Cloudflare Pages. Ветка `main` содержит коммиты, которые не дошли до продакшна.

### Группа B. Интерфейс и удобство (UI/UX)
1. **Скрытая навигация на мобильных устройствах (Mobile Nav Obscuration):**
   - На экранах 390px (iPhone 12/13/14) верхняя панель `.nav-list` горизонтально прокручивается, но по умолчанию отображает только одну кнопку: `[ ⊞ Triage ]`. Пользователь не видит вкладок `Portfolio`, `Experiments`, `Attention`, `Nodes`, `Reports`, `Discovery`.
   - При переходе по прямой ссылке (например, `#portfolio` или `#project/...`) панель не прокручивается автоматически к активному табу (`scrollLeft = 0`), создавая иллюзию, что открыт Триаж.
2. **Множественные горизонтальные полосы прокрутки в Node View на мобильных устройствах:**
   - В мобильном виде `/nodes` друг под другом располагаются 4 горизонтальные полосы прокрутки:
     1. Верхняя навигация.
     2. Переключатель проектов (`Business Discovery`, `Murat Project Engineer`).
     3. Фильтры типов узлов (`Проект`, `Подсистема`, `Evidence`).
     4. Легенда связей (`Использует`, `Зависит от`, `Подтверждает`).
   - Это перегружает компактный экран и затрудняет вертикальный скролл страницы.
3. **Обрыв текста и перенос в футере карточек проекта (Desktop & Mobile):**
   - В футере карточки строка источника (например, `Источник: Murkin1980/salamat-projects-dashboard · 86a06d...:PROJECT_STATUS.md`) переносится некорректно: разделительная точка `·` часто остаётся висеть отдельной строкой или переносится с обрывом хеша коммита.
4. **Неполнота данных в Project Detail:**
   - В детальном виде `Salamat Projects Dashboard` поля «ТЕКУЩИЙ ЭТАП» и «СЛЕДУЮЩЕЕ ДЕЙСТВИЕ» отображают «Не определено источником», хотя в локальном `PROJECT_STATUS.md` эти данные присутствуют в явном виде (парсер GitHub-адаптера ожидает специфический формат заголовка).

---

## 3. Скриншоты и Evidence

Все скриншоты сняты напрямую с боевого сайта `https://projects.salamat-mebel.kz` через headless Chrome с точной эмуляцией разрешений Desktop (1440×1000) и Mobile (390×844, Device Scale Factor 2, Mobile viewport).

### Desktop Screenshots (1440×1000)
- **Triage (Десктоп):**
  Файл: `screenshots/desktop-triage.png`  
  *Evidence:* 15 проектов требуют внимания (красный бейдж `УСТАРЕЛА` на всех карточках).
- **Portfolio (Десктоп):**
  Файл: `screenshots/desktop-portfolio.png`  
  *Evidence:* Сетка всех 15 проектов, статусная плашка Arena UNKNOWN, ссылка «Открыть проект →».
- **Attention (Десктоп):**
  Файл: `screenshots/desktop-attention.png`  
  *Evidence:* 100% проектов в списке внимания с причинами `STALE`, `BLOCKER`, `VALIDATION`.
- **Node View (Десктоп):**
  Файл: `screenshots/desktop-nodes.png`  
  *Evidence:* Граф Business Discovery со статусом `SOURCE CONFLICT`, инспектор узла Auditor.
- **History & Reports (Десктоп):**
  Файл: `screenshots/desktop-reports.png`  
  *Evidence:* Хронология коммитов и PR, последний PR #35 от 12 октября 2026 г.
- **Discovery (Десктоп):**
  Файл: `screenshots/desktop-discovery.png`  
  *Evidence:* Корректный fail-closed статус `Discovery data unavailable` (нет прав токена).
- **Project Detail — Salamat Dashboard (Десктоп):**
  Файл: `screenshots/desktop-detail-salamat.png`  
  *Evidence:* Детальная карточка с историей и признаком активности.

### Mobile Screenshots (390×844)
- **Triage (Мобильный):**
  Файл: `screenshots/mobile-triage-emulated.png`  
  *Evidence:* В шапке виден только таб `Triage`. Текст описания и KPI скомпонованы в 2×2.
- **Portfolio (Мобильный):**
  Файл: `screenshots/mobile-portfolio-emulated.png`  
  *Evidence:* Одноколоночная вёрстка карточек.
- **Node View (Мобильный):**
  Файл: `screenshots/mobile-nodes-emulated.png`  
  *Evidence:* 4 уровня горизонтальных скролл-панелей подряд, компактные карточки узлов.
- **Project Detail (Мобильный):**
  Файл: `screenshots/mobile-detail-emulated.png`  
  *Evidence:* Читаемая карточка проекта, кнопки «← Портфель» и «⊞ Триаж».

---

## 4. Предлагаемые минимальные исправления

Следуя принципу MPE Scope & Change Control (минимальный достаточный диффуз, без переписывания архитектуры):

1. **Автопрокрутка активного таба на мобильных устройствах (`src/components/DashboardApp.tsx`, `src/styles.css`):**
   - Добавить `scrollIntoView({ inline: 'center', behavior: 'smooth' })` для кнопки активного таба при монтировании/смене маршрута, либо добавить визуальный градиентный индикатор переполнения (fade indicator) справа от `.nav-list`.
2. **Устранение висячей точки и некрасивого переноса в футере карточек (`src/styles.css`):**
   - Обернуть разделитель и хеш коммита в элемент с `white-space: nowrap` или перевести блок атрибуции на компактную двухстрочную сетку, предотвращающую сиротливые символы.
3. **Улучшение парсинга этапов в адаптере (`src/adapters/github-source.ts`):**
   - Расширить регулярные выражения для извлечения `stage` и `nextAction` из `PROJECT_STATUS.md`, когда файл использует альтернативные подзаголовки (например, `Current checkpoint:` или `Next:`).
4. **Стабилизация CI-деплоя Cloudflare Pages (`.github/workflows/deploy-cloudflare-pages.yml`):**
   - Проверить причину падения `c26ae63` в Cloudflare Pages (проверить лимиты файлов/размера бандла или тайм-аут конвергенции `verify production snapshot`).

---

## 5. Пересечение с текущими задачами Codex

Чтобы исключить дублирование усилий и конфликты веток:

1. **Ветка `origin/fix/portfolio-freshness-audit-20261012` (PR #35):**
   - Codex уже разработал скрипт `scripts/report-portfolio-freshness.mjs`, который проверяет покрытие источников и выводит предупреждения о stale-проектах в шаге валидации CI.
   - **Рекомендация:** НЕ создавать параллельный скрипт аудита свежести. Использовать наработки PR #35.
2. **Ветка `origin/fix/cp13-sync-fallback-deploy`:**
   - Codex работает над обработкой недоступных приватных репозиториев в `sync:github` и восстановлением безопасного фоллбэка снапшота при сбое синхронизации.
   - **Рекомендация:** Дождаться завершения или использовать спецификацию `fix/cp13-sync-fallback-deploy` для решения проблемы 403 Forbidden.
3. **Эксперимент `aa150e8` (PR #31, `docs/UI_SKILLS_EXPERIMENT.md`):**
   - Codex/Arena уже добавили 103 строки мобильного CSS (правила `overflow-wrap: anywhere`, тач-таргеты 44px).
   - Настоящий аудит подтверждает, что переполнение контента на 390px устранено (`docWidth == 390`), но навигация по табам требует финальной доработки.

---

## 6. Следующий рекомендуемый checkpoint

Согласно дорожной карте в `CHECKPOINTS.md` репозитория:
- **CP-18 — Recent Activity Feed** (в очереди).
- **CP-19 — Portfolio Coverage & Data Quality Hardening** (целевой checkpoint для решения выявленных проблем с данными).
- **CP-20 — Production UX & Acceptance** (целевой checkpoint для полировки мобильного UX).

**Рекомендация:**
1. Не начинать самостоятельную реализацию без отдельного согласования владельца.
2. Первоочередное действие для владельца:
   - Влить PR #35 / стабилизировать деплой `main` в Cloudflare Pages.
   - Предоставить чтение приватных репозиториев токену `GH_TOKEN` (или зафиксировать в CP-19 официальный статус GAP для недоступных репозиториев).
   - Предоставить токену Cloudflare права `Zone:Read`, `Analytics:Read` для зоны `salamat-mebel.kz`.
